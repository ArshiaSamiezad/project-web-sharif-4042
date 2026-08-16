import logging
import os
import time

from django.conf import settings
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

from apps.catalog.models import Track
from apps.catalog.serializers import TrackSerializer

logger = logging.getLogger(__name__)


class RecommendPayload(BaseModel):
    trackIds: list[int] = Field(
        description='Up to 10 unique track IDs chosen only from the candidate list, best match first.',
    )


def _log(message):
    line = f'[Sepatify Gemini] {message}'
    print(line, flush=True)


def _playlist_context(playlist_tracks):
    artist_ids = {track.artist_id for track in playlist_tracks}
    album_ids = {track.album_id for track in playlist_tracks if track.album_id}
    artist_names = sorted(
        {
            track.artist.public_artist_name
            for track in playlist_tracks
            if track.artist_id
        }
    )
    album_titles = sorted(
        {
            track.album.title
            for track in playlist_tracks
            if track.album_id and getattr(track, 'album', None)
        }
    )
    return {
        'artist_ids': artist_ids,
        'album_ids': album_ids,
        'artist_names': artist_names,
        'album_titles': album_titles,
    }


def _candidate_priority(track, context):
    score = 0
    if track.album_id and track.album_id in context['album_ids']:
        score += 3
    if track.artist_id in context['artist_ids']:
        score += 2
    return score


def _candidate_queryset(playlist, context):
    in_playlist = playlist.playlist_tracks.values_list('track_id', flat=True)
    tracks = list(
        Track.objects.select_related('artist', 'album')
        .exclude(id__in=in_playlist)
    )
    tracks.sort(
        key=lambda track: (
            _candidate_priority(track, context),
            track.plays or 0,
            track.id,
        ),
        reverse=True,
    )
    return tracks


def _format_track_line(track, context=None):
    album_title = track.album.title if track.album_id else 'single'
    flags = []
    if context:
        if track.album_id and track.album_id in context['album_ids']:
            flags.append('SAME_ALBUM')
        if track.artist_id in context['artist_ids']:
            flags.append('SAME_ARTIST')
    flag_text = f' | flags={",".join(flags)}' if flags else ''
    return (
        f'- id={track.id} | title={track.title} | '
        f'artist={track.artist.public_artist_name} | '
        f'album={album_title} | genre={track.genre}{flag_text}'
    )


def _build_prompt(playlist, playlist_tracks, candidates, context):
    playlist_lines = [_format_track_line(track) for track in playlist_tracks] or [
        '- (playlist is empty; use the playlist title only)'
    ]

    priority = [
        track
        for track in candidates
        if _candidate_priority(track, context) > 0
    ]
    other = [
        track
        for track in candidates
        if _candidate_priority(track, context) == 0
    ]

    priority_lines = [_format_track_line(track, context) for track in priority[:180]]
    other_lines = [_format_track_line(track, context) for track in other[:100]]

    shared_artists = ', '.join(context['artist_names']) or '(none yet)'
    shared_albums = ', '.join(context['album_titles']) or '(none yet)'

    return (
        'You are a music recommendation engine for Sepatify.\n'
        'Primary goal: recommend tracks that share the SAME ARTISTS and/or SAME ALBUMS '
        'as songs already in the playlist.\n'
        'Ranking rules (strict):\n'
        '1) Prefer SAME_ALBUM candidates first.\n'
        '2) Then prefer SAME_ARTIST candidates.\n'
        '3) Only if needed, fill with other genre-similar candidates.\n'
        'You MUST choose track IDs only from the candidate lists below. Never invent IDs.\n'
        'Return exactly 10 IDs when at least 10 candidates exist; otherwise return all available.\n'
        'Rank best matches first.\n\n'
        f'PLAYLIST TITLE: {playlist.title}\n'
        f'SHARED ARTISTS IN PLAYLIST: {shared_artists}\n'
        f'SHARED ALBUMS IN PLAYLIST: {shared_albums}\n\n'
        'CURRENT PLAYLIST TRACKS:\n'
        + '\n'.join(playlist_lines)
        + '\n\nPRIORITY CANDIDATES (same artist/album — prefer these):\n'
        + ('\n'.join(priority_lines) if priority_lines else '- (none)')
        + '\n\nOTHER CANDIDATES (use only to fill remaining slots):\n'
        + ('\n'.join(other_lines) if other_lines else '- (none)')
    )


def _normalize_ids(raw_ids, candidate_ids, limit=10):
    allowed = set(candidate_ids)
    ordered = []
    seen = set()

    for raw in raw_ids or []:
        try:
            track_id = int(raw)
        except (TypeError, ValueError):
            continue
        if track_id not in allowed or track_id in seen:
            continue
        ordered.append(track_id)
        seen.add(track_id)
        if len(ordered) >= limit:
            return ordered

    for track_id in candidate_ids:
        if len(ordered) >= limit:
            break
        if track_id in seen:
            continue
        ordered.append(track_id)
        seen.add(track_id)

    return ordered


def _is_retryable(exc):
    text = str(exc).upper()
    return any(
        token in text
        for token in (
            '503',
            'UNAVAILABLE',
            '429',
            'RESOURCE_EXHAUSTED',
            'HIGH DEMAND',
            'TRY AGAIN',
            'DEADLINE',
            'TIMEOUT',
        )
    )


def _model_candidates(primary):
    preferred = [
        primary,
        'gemini-flash-latest',
        'gemini-flash-lite-latest',
        'gemini-3.1-flash-lite',
        'gemini-3.5-flash-lite',
    ]
    ordered = []
    seen = set()
    for name in preferred:
        key = (name or '').strip()
        if not key or key in seen:
            continue
        seen.add(key)
        ordered.append(key)
    return ordered


def _call_gemini(prompt, playlist):
    api_key = (getattr(settings, 'GEMINI_API_KEY', None) or os.environ.get('GEMINI_API_KEY') or '').strip()
    if not api_key:
        raise RuntimeError('GEMINI_API_KEY is not configured.')

    primary = getattr(settings, 'GEMINI_MODEL', None) or 'gemini-flash-latest'
    models = _model_candidates(primary)
    client = genai.Client(api_key=api_key)
    config = types.GenerateContentConfig(
        temperature=0.3,
        response_mime_type='application/json',
        response_schema=RecommendPayload,
    )

    last_error = None
    for model in models:
        for attempt in range(1, 4):
            _log(
                f'Calling model={model} attempt={attempt}/3 '
                f'playlist_id={playlist.id} title="{playlist.title}" '
                f'prompt_chars={len(prompt)}'
            )
            started = time.perf_counter()
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=config,
                )
                elapsed_ms = int((time.perf_counter() - started) * 1000)
                text = (response.text or '').strip()
                if not text:
                    raise RuntimeError('Empty response from model.')
                payload = RecommendPayload.model_validate_json(text)
                _log(f'Response OK model={model} in {elapsed_ms}ms trackIds={payload.trackIds}')
                return payload.trackIds
            except Exception as exc:
                elapsed_ms = int((time.perf_counter() - started) * 1000)
                last_error = exc
                _log(f'Attempt failed model={model} attempt={attempt} after {elapsed_ms}ms: {exc}')
                if not _is_retryable(exc) or attempt >= 3:
                    break
                delay = 1.2 * attempt
                _log(f'Retrying in {delay:.1f}s…')
                time.sleep(delay)

    if last_error and _is_retryable(last_error):
        raise RuntimeError(
            'Recommendation service is busy right now. Please try again in a moment.'
        ) from last_error
    raise RuntimeError(
        f'Recommendation failed: {last_error}' if last_error else 'Recommendation failed.'
    ) from last_error


def recommend_tracks_for_playlist(playlist, request=None, limit=10):
    playlist_tracks = [
        entry.track
        for entry in playlist.playlist_tracks.select_related(
            'track__artist',
            'track__album',
        ).order_by('position', 'id')
    ]
    context = _playlist_context(playlist_tracks)
    _log(
        f'Start recommend playlist_id={playlist.id} title="{playlist.title}" '
        f'in_playlist={len(playlist_tracks)} '
        f'shared_artists={context["artist_names"]} '
        f'shared_albums={context["album_titles"]}'
    )

    candidates = _candidate_queryset(playlist, context)
    if not candidates:
        _log(f'No candidates left for playlist_id={playlist.id}')
        return {
            'trackIds': [],
            'tracks': [],
            'detail': 'No candidate tracks left outside this playlist.',
        }

    priority_count = sum(1 for track in candidates if _candidate_priority(track, context) > 0)
    _log(
        f'Candidates total={len(candidates)} priority_same_artist_or_album={priority_count}'
    )

    candidate_ids = [track.id for track in candidates]
    prompt = _build_prompt(playlist, playlist_tracks, candidates, context)

    try:
        raw_ids = _call_gemini(prompt, playlist)
    except Exception as exc:
        _log(f'FAILED playlist_id={playlist.id}: {exc}')
        logger.exception('Gemini recommendation failed')
        raise RuntimeError(f'Recommendation failed: {exc}') from exc

    selected_ids = _normalize_ids(raw_ids, candidate_ids, limit=limit)
    by_id = {track.id: track for track in candidates}
    selected_tracks = [by_id[track_id] for track_id in selected_ids if track_id in by_id]
    _log(
        f'Done playlist_id={playlist.id} selected='
        + ', '.join(
            f'{track.id}:{track.title}[{track.artist.public_artist_name}]'
            for track in selected_tracks
        )
    )

    serializer = TrackSerializer(
        selected_tracks,
        many=True,
        context={'request': request},
    )
    return {
        'trackIds': selected_ids,
        'tracks': serializer.data,
    }
