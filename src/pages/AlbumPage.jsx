import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePlaying } from '../context/PlayingContext'
import { useI18n } from '../i18n/I18nProvider'
import PlaylistMenu from '../components/PlaylistMenu'
import PlayingBars from '../components/PlayingBars'
import './CatalogPages.css'

export default function AlbumPage() {
  const { albumId } = useParams()
  const { currentUser, getCatalog, getUserById } = useAuth()
  const { playingTrackId, playTrack } = usePlaying()
  const { t, formatNumber, language } = useI18n()
  const navigate = useNavigate()
  const catalog = getCatalog()

  const album = catalog.albums.find((item) => item.id === albumId)
  if (!album) return <Navigate to="/catalog" replace />

  const isGold = currentUser?.subscription === 'gold'
  if (album.earlyAccess && !isGold) {
    return <Navigate to="/catalog" replace />
  }

  const artist = getUserById(album.artistId)
  const tracks = catalog.tracks
    .filter((track) => track.albumId === album.id)
    .filter((track) => isGold || !track.earlyAccess)
    .sort((a, b) => (b.plays || 0) - (a.plays || 0))

  function formatFeat(list) {
    if (!Array.isArray(list) || list.length === 0) return ''
    return list.join(language === 'en' ? ', ' : '، ')
  }

  return (
    <div className="catalog album-page">
      <button type="button" className="album-page__back" onClick={() => navigate('/catalog')}>
        {t('catalog.backToCatalog')}
      </button>

      <header className="album-page__hero">
        <img src={album.cover} alt="" className="album-page__cover" />
        <div className="album-page__info">
          <p className="album-page__eyebrow">{t('common.album')}</p>
          <h1>{album.title}</h1>
          <Link
            to={artist?.username ? `/profile/${artist.username}` : '/profile'}
            className="album-page__artist"
          >
            {album.artistName}
          </Link>
          <p className="album-page__meta">
            {album.genre ? (
              <>
                <span>{album.genre}</span>
                <span>·</span>
              </>
            ) : null}
            <span dir="ltr">{album.releasedAt}</span>
            <span>·</span>
            <span>
              {t('common.listenerCount', { count: formatNumber(album.listeners || 0) })}
            </span>
            <span>·</span>
            <span>{t('common.pieceCount', { count: formatNumber(tracks.length) })}</span>
          </p>
          <div className="album-page__actions">
            <PlaylistMenu mode="album" albumId={album.id} />
          </div>
        </div>
      </header>

      {tracks.length === 0 ? (
        <p className="catalog__empty">{t('catalog.emptyAlbumTracks')}</p>
      ) : (
        <ul className="album-page__tracks">
          {tracks.map((track, index) => {
            const isPlaying = playingTrackId === track.id
            const feat = formatFeat(track.collaborators)
            return (
              <li
                key={track.id}
                className={`album-track${isPlaying ? ' is-playing' : ''}`}
              >
                <span className="album-track__index" aria-hidden="true">
                  {isPlaying ? <PlayingBars /> : formatNumber(index + 1)}
                </span>
                <button
                  type="button"
                  className="album-track__cover"
                  onClick={() => playTrack(track.id)}
                  aria-label={
                    isPlaying
                      ? t('common.pauseAria', { title: track.title })
                      : t('common.playAria', { title: track.title })
                  }
                >
                  <img src={track.cover} alt="" />
                </button>
                <div className="album-track__text">
                  <button
                    type="button"
                    className="album-track__title"
                    onClick={() => playTrack(track.id)}
                  >
                    {track.title}
                  </button>
                  <p className="album-track__artist-row">
                    <Link
                      to={artist?.username ? `/profile/${artist.username}` : '/profile'}
                      className="album-track__artist"
                    >
                      {track.artistName}
                    </Link>
                    {feat ? (
                      <span className="album-track__feat">
                        {t('common.featuring', { names: feat })}
                      </span>
                    ) : null}
                  </p>
                </div>
                {isPlaying ? (
                  <span className="album-track__badge">{t('common.nowPlaying')}</span>
                ) : null}
                <span className="album-track__plays">{formatNumber(track.plays || 0)}</span>
                <div className="album-track__menu">
                  <PlaylistMenu mode="track" trackId={track.id} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
