// Developer: Moeid Nadi - 402106683

/**
 * normalizeTrack
 * Different parts of Sepatify (search results, playlists, seed data, API
 * responses) don't always agree on field names. This coerces any track
 * shape into one consistent object so player components never have to
 * guess whether a field is `cover` or `coverImage`, `artist` or `artistName`, etc.
 *
 * @param {object|null|undefined} track
 * @returns {object|null}
 */
export function normalizeTrack(track) {
  if (!track) return null;

  return {
    id: track.id ?? track._id ?? null,
    title: track.title ?? track.name ?? "Unknown title",
    artistName: track.artistName ?? track.artist ?? "Unknown artist",
    artistId: track.artistId ?? track.artist_id ?? track.artistID ?? null,
    albumName: track.albumName ?? track.album ?? null,
    albumId: track.albumId ?? track.album_id ?? track.albumID ?? null,
    coverImage:
      track.coverImage ?? track.cover ?? track.image ?? track.artwork ?? "/default-cover.png",
    audioUrl: track.audioUrl ?? track.url ?? track.src ?? null,
    lyrics: track.lyrics ?? null,
    listenersCount: track.listenersCount ?? track.listeners ?? null,
    streamsCount: track.streamsCount ?? track.streams ?? null,
  };
}
