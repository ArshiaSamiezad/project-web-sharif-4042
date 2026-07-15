import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePlaying } from '../context/PlayingContext'
import PlaylistMenu from '../components/PlaylistMenu'
import PlayingBars from '../components/PlayingBars'
import './CatalogPages.css'

export default function AlbumPage() {
  const { albumId } = useParams()
  const { currentUser, getCatalog, getUserById } = useAuth()
  const { playingTrackId, playTrack } = usePlaying()
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

  return (
    <div className="catalog album-page">
      <button type="button" className="album-page__back" onClick={() => navigate('/catalog')}>
        بازگشت به آرشیو
      </button>

      <header className="album-page__hero">
        <img src={album.cover} alt="" className="album-page__cover" />
        <div className="album-page__info">
          <p className="album-page__eyebrow">آلبوم</p>
          <h1>{album.title}</h1>
          <Link
            to={artist?.username ? `/profile/${artist.username}` : '/profile'}
            className="album-page__artist"
          >
            {album.artistName}
          </Link>
          <p className="album-page__meta">
            <span dir="ltr">{album.releasedAt}</span>
            <span>·</span>
            <span>{(album.listeners || 0).toLocaleString('fa-IR')} شنونده</span>
            <span>·</span>
            <span>{tracks.length.toLocaleString('fa-IR')} قطعه</span>
          </p>
          <div className="album-page__actions">
            <PlaylistMenu mode="album" albumId={album.id} />
          </div>
        </div>
      </header>

      {tracks.length === 0 ? (
        <p className="catalog__empty">آهنگی برای این آلبوم ثبت نشده است.</p>
      ) : (
        <ul className="album-page__tracks">
          {tracks.map((track, index) => {
            const isPlaying = playingTrackId === track.id
            return (
              <li
                key={track.id}
                className={`album-track${isPlaying ? ' is-playing' : ''}`}
              >
                <span className="album-track__index" aria-hidden="true">
                  {isPlaying ? <PlayingBars /> : (index + 1).toLocaleString('fa-IR')}
                </span>
                <button
                  type="button"
                  className="album-track__cover"
                  onClick={() => playTrack(track.id)}
                  aria-label={isPlaying ? `توقف ${track.title}` : `پخش ${track.title}`}
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
                  <Link
                    to={artist?.username ? `/profile/${artist.username}` : '/profile'}
                    className="album-track__artist"
                  >
                    {track.artistName}
                  </Link>
                </div>
                {isPlaying ? (
                  <span className="album-track__badge">در حال پخش</span>
                ) : null}
                <span className="album-track__plays">
                  {(track.plays || 0).toLocaleString('fa-IR')}
                </span>
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
