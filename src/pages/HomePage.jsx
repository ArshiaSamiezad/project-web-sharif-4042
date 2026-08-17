import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePlaying } from '../context/PlayingContext'
import PlayingBars from '../components/PlayingBars'
import { useI18n } from '../i18n/I18nProvider'
import './HomePage.css'

function TileRow({ children }) {
  return (
    <div className="home__scroller">
      <div className="home__track">{children}</div>
    </div>
  )
}

export default function HomePage() {
  const { currentUser, getCatalog, getUserById } = useAuth()
  const { playingTrackId, playTrack } = usePlaying()
  const { t } = useI18n()
  const navigate = useNavigate()
  const catalog = getCatalog()

  const ownedPlaylists = catalog.playlists.filter((p) => String(p.ownerId) === String(currentUser.id))
  const recentPlaylists = (currentUser.recentPlaylistIds || [])
    .map((id) => catalog.playlists.find((p) => String(p.id) === String(id)))
    .filter((p) => p && String(p.ownerId) === String(currentUser.id))
  const homePlaylists = recentPlaylists.length > 0 ? recentPlaylists : ownedPlaylists

  // catalog.albums/tracks are already early-access-filtered for this viewer
  // by the backend (see AuthContext.refreshCatalog) — no tier check here.
  const latestAlbums = [...catalog.albums].sort((a, b) =>
    String(b.releasedAt).localeCompare(String(a.releasedAt)),
  )

  const popularTracks = [...catalog.tracks]
    .filter((track) => !track.earlyAccess)
    .sort((a, b) => (b.plays || 0) - (a.plays || 0))

  const earlyAccessItems = [
    ...catalog.albums.filter((a) => a.earlyAccess).map((a) => ({ ...a, kind: 'album' })),
    ...catalog.tracks
      .filter((track) => track.earlyAccess)
      .map((track) => ({ ...track, kind: 'track' })),
  ]

  function artistPath(artistId) {
    const user = getUserById(artistId)
    return user?.username ? `/profile/${user.username}` : '/profile'
  }

  return (
    <div className="home">
      <section className="home__section">
        <h2>{t('home.recentPlaylists')}</h2>
        <TileRow>
          {homePlaylists.map((item) => (
            <article
              key={item.id}
              className="home__tile"
              role="link"
              tabIndex={0}
              onClick={() => navigate(`/playlist/${item.id}`)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  navigate(`/playlist/${item.id}`)
                }
              }}
            >
              <img src={item.cover} alt="" />
              <h3>{item.title}</h3>
            </article>
          ))}
        </TileRow>
      </section>

      <section className="home__section">
        <h2>{t('home.latestAlbums')}</h2>
        <TileRow>
          {latestAlbums.map((item) => (
            <article key={item.id} className="home__tile">
              <button
                type="button"
                className="home__tile-cover"
                onClick={() => navigate(`/album/${item.id}`)}
                aria-label={t('common.openAlbumAria', { title: item.title })}
              >
                <img src={item.cover} alt="" />
              </button>
              <button
                type="button"
                className="home__tile-title"
                onClick={() => navigate(`/album/${item.id}`)}
              >
                {item.title}
              </button>
              <p className="home__tile-meta-row">
                <span className="home__kind">{t('common.album')}</span>
                <span className="home__kind-sep" aria-hidden="true">
                  •
                </span>
                <Link
                  to={artistPath(item.artistId)}
                  className="home__tile-meta"
                  onClick={(event) => event.stopPropagation()}
                >
                  {item.artistName}
                </Link>
              </p>
              {item.genre ? <p className="home__tile-meta">{item.genre}</p> : null}
            </article>
          ))}
        </TileRow>
      </section>

      <section className="home__section">
        <h2>{t('home.popularTracks')}</h2>
        <TileRow>
          {popularTracks.map((item) => {
            const isPlaying = playingTrackId === item.id
            return (
              <article
                key={item.id}
                className={`home__tile${isPlaying ? ' is-playing' : ''}`}
              >
                <button
                  type="button"
                  className="home__tile-cover"
                  onClick={() => playTrack(item.id)}
                  aria-label={
                    isPlaying
                      ? t('common.pauseAria', { title: item.title })
                      : t('common.playAria', { title: item.title })
                  }
                >
                  <img src={item.cover} alt="" />
                  {isPlaying ? (
                    <span className="home__playing">
                      <PlayingBars />
                      <span>{t('common.nowPlaying')}</span>
                    </span>
                  ) : (
                    <span className="home__play-hint" aria-hidden="true">
                      ▶
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className="home__tile-title"
                  onClick={() => playTrack(item.id)}
                >
                  {item.title}
                </button>
                <p className="home__tile-meta-row">
                  <span className="home__kind">{t('common.single')}</span>
                  <span className="home__kind-sep" aria-hidden="true">
                    •
                  </span>
                  <Link to={artistPath(item.artistId)} className="home__tile-meta">
                    {item.artistName}
                  </Link>
                </p>
                {item.genre ? <p className="home__tile-meta">{item.genre}</p> : null}
              </article>
            )
          })}
        </TileRow>
      </section>

      {earlyAccessItems.length > 0 ? (
        <section className="home__section home__section--early">
          <h2>{t('home.earlyAccess')}</h2>
          <TileRow>
            {earlyAccessItems.map((item) => {
              if (item.kind === 'album') {
                return (
                  <article key={`ea-album-${item.id}`} className="home__tile">
                    <button
                      type="button"
                      className="home__tile-cover"
                      onClick={() => navigate(`/album/${item.id}`)}
                      aria-label={t('common.openAlbumAria', { title: item.title })}
                    >
                      <img src={item.cover} alt="" />
                    </button>
                    <button
                      type="button"
                      className="home__tile-title"
                      onClick={() => navigate(`/album/${item.id}`)}
                    >
                      {item.title}
                    </button>
                    <p className="home__tile-meta-row">
                      <span className="home__kind">{t('common.album')}</span>
                      <span className="home__kind-sep" aria-hidden="true">
                        •
                      </span>
                      <Link to={artistPath(item.artistId)} className="home__tile-meta">
                        {item.artistName}
                      </Link>
                    </p>
                  </article>
                )
              }

              const isPlaying = playingTrackId === item.id
              return (
                <article
                  key={`ea-track-${item.id}`}
                  className={`home__tile${isPlaying ? ' is-playing' : ''}`}
                >
                  <button
                    type="button"
                    className="home__tile-cover"
                    onClick={() => playTrack(item.id)}
                    aria-label={
                      isPlaying
                        ? t('common.pauseAria', { title: item.title })
                        : t('common.playAria', { title: item.title })
                    }
                  >
                    <img src={item.cover} alt="" />
                    {isPlaying ? (
                      <span className="home__playing">
                        <PlayingBars />
                        <span>{t('common.nowPlaying')}</span>
                      </span>
                    ) : (
                      <span className="home__play-hint" aria-hidden="true">
                        ▶
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    className="home__tile-title"
                    onClick={() => playTrack(item.id)}
                  >
                    {item.title}
                  </button>
                  <p className="home__tile-meta-row">
                    <span className="home__kind">{t('common.single')}</span>
                    <span className="home__kind-sep" aria-hidden="true">
                      •
                    </span>
                    <Link to={artistPath(item.artistId)} className="home__tile-meta">
                      {item.artistName}
                    </Link>
                  </p>
                </article>
              )
            })}
          </TileRow>
        </section>
      ) : null}
    </div>
  )
}
