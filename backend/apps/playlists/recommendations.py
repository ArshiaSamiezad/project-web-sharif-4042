import logging
import os

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


def _candidate_queryset(playlist):
    in_playlist = playlist.playlist_tracks.values_list('track_id', flat=True)
    return (
        Track.objects.select_related('artist', 'album')
        .exclude(id__in=in_playlist)
        .order_by('-plays', '-id')
    )


def _format_track_line(track):
    return (
        f'- id={track.id} | title={track.title} | '
        f'artist={track.artist.public_artist_name} | genre={track.genre}'
    )


def _build_prompt(playlist, playlist_tracks, candidates):
    playlist_lines = [_format_track_line(track) for track in playlist_tracks] or [
        '- (playlist is empty; use the playlist title and typical taste for this name)'
    ]
    candidate_lines = [_format_track_line(track) for track in candidates[:280]]

    return (
        'You are a music recommendation engine for Sepatify.\n'
        'Pick tracks that fit the playlist theme and the songs already in it.\n'
        'You MUST choose track IDs only from the CANDIDATES list. Never invent IDs.\n'
        'Return exactly 10 IDs when at least 10 candidates exist; otherwise return all candidates.\n'
        'Rank best matches first.\n\n'
        f'PLAYLIST TITLE: {playlist.title}\n\n'
        'CURRENT PLAYLIST TRACKS (title / artist / genre):\n'
        + '\n'.join(playlist_lines)
        + '\n\nCANDIDATES (choose only from these IDs):\n'
        + '\n'.join(candidate_lines)
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


def _call_gemini(prompt):
    api_key = (getattr(settings, 'GEMINI_API_KEY', None) or os.environ.get('GEMINI_API_KEY') or '').strip()
    if not api_key:
        raise RuntimeError('GEMINI_API_KEY is not configured.')

    model = getattr(settings, 'GEMINI_MODEL', None) or 'gemini-flash-latest'
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.4,
            response_mime_type='application/json',
            response_schema=RecommendPayload,
        ),
    )

    text = (response.text or '').strip()
    if not text:
        raise RuntimeError('Gemini returned an empty response.')

    payload = RecommendPayload.model_validate_json(text)
    return payload.trackIds


def recommend_tracks_for_playlist(playlist, request=None, limit=10):
    candidates = list(_candidate_queryset(playlist))
    if not candidates:
        return {
            'trackIds': [],
            'tracks': [],
            'detail': 'No candidate tracks left outside this playlist.',
        }

    playlist_tracks = [
        entry.track
        for entry in playlist.playlist_tracks.select_related('track__artist').order_by(
            'position',
            'id',
        )
    ]
    candidate_ids = [track.id for track in candidates]
    prompt = _build_prompt(playlist, playlist_tracks, candidates)

    try:
        raw_ids = _call_gemini(prompt)
    except Exception as exc:
        logger.exception('Gemini recommendation failed')
        raise RuntimeError(f'Recommendation failed: {exc}') from exc

    selected_ids = _normalize_ids(raw_ids, candidate_ids, limit=limit)
    by_id = {track.id: track for track in candidates}
    selected_tracks = [by_id[track_id] for track_id in selected_ids if track_id in by_id]

    serializer = TrackSerializer(
        selected_tracks,
        many=True,
        context={'request': request},
    )
    return {
        'trackIds': selected_ids,
        'tracks': serializer.data,
    }
