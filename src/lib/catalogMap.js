import { normalizeId } from './ids'

export function buildUserIdMaps(localUsers, apiUsers) {
  const byEmail = new Map(
    (apiUsers || []).map((user) => [String(user.email || '').toLowerCase(), user]),
  )
  const localToApi = new Map()
  const apiToLocal = new Map()

  for (const local of localUsers || []) {
    const apiUser = byEmail.get(String(local.email || '').toLowerCase())
    if (!apiUser) continue
    localToApi.set(String(local.id), apiUser.id)
    apiToLocal.set(String(apiUser.id), local.id)
  }

  return { localToApi, apiToLocal }
}

export function toApiUserId(localId, maps) {
  const apiId = maps.localToApi.get(String(localId))
  if (apiId == null) {
    throw new Error('User is not linked to the backend. Run seed_demo and match user emails.')
  }
  return apiId
}

export function toLocalUserId(apiId, maps) {
  return maps.apiToLocal.get(String(apiId)) ?? normalizeId(apiId)
}

export function mapAlbumFromApi(album, maps) {
  return {
    ...album,
    id: normalizeId(album.id),
    artistId: normalizeId(toLocalUserId(album.artistId, maps)),
    trackIds: (album.trackIds || []).map(normalizeId),
    collaborators: album.collaborators || [],
  }
}

export function mapTrackFromApi(track, maps) {
  return {
    ...track,
    id: normalizeId(track.id),
    artistId: normalizeId(toLocalUserId(track.artistId, maps)),
    albumId: track.albumId == null ? null : normalizeId(track.albumId),
    coverImage: track.coverImage || track.cover || '',
    collaborators: track.collaborators || [],
    lyrics: track.lyrics || '',
    audio: track.audio || null,
    audioUrl: track.audioUrl || '',
  }
}

export function mapPlaylistFromApi(playlist, maps) {
  return {
    ...playlist,
    id: normalizeId(playlist.id),
    ownerId: normalizeId(toLocalUserId(playlist.ownerId, maps)),
    trackIds: (playlist.trackIds || []).map(normalizeId),
  }
}
