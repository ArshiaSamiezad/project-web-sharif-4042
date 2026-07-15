import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePlaying } from '../context/PlayingContext'
import PlayingBars from '../components/PlayingBars'
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
  const navigate = useNavigate()
  const catalog = getCatalog()

  const isGold = currentUser.subscription === 'gold'

  const recentPlaylists = (currentUser.recentPlaylistIds || [])
    .map((id) => catalog.playlists.find((p) => p.id === id))
    .filter(Boolean)

  const latestAlbums = [...catalog.albums]
    .filter((a) => isGold || !a.earlyAccess)
    .sort((a, b) => b.releasedAt.localeCompare(a.releasedAt))

  const popularTracks = [...catalog.tracks]
    .filter((t) => !t.earlyAccess)
    .sort((a, b) => b.plays - a.plays)

  const earlyAccessItems = [
    ...catalog.albums.filter((a) => a.earlyAccess).map((a) => ({ ...a, kind: 'album' })),
    ...catalog.tracks.filter((t) => t.earlyAccess).map((t) => ({ ...t, kind: 'track' })),
  ]

  function artistPath(artistId) {
    const user = getUserById(artistId)
    return user?.username ? `/profile/${user.username}` : '/profile'
  }

  return (
    <div className="home">
      <section className="home__section">
        <h2>آخرین پلی‌لیست‌های شنیده‌شده</h2>
        <TileRow>
          {recentPlaylists.map((item) => (
            <article
              key={item.id}
              className="home__tile"
              role="link"
              tabIndex={0}
              onClick={() => navigate('/playlists')}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  navigate('/playlists')
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
        <h2>آخرین آلبوم‌های منتشرشده</h2>
        <TileRow>
          {latestAlbums.map((item) => (
            <article key={item.id} className="home__tile">
              <button
                type="button"
                className="home__tile-cover"
                onClick={() => navigate(`/album/${item.id}`)}
                aria-label={`باز کردن آلبوم ${item.title}`}
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
              <Link
                to={artistPath(item.artistId)}
                className="home__tile-meta"
                onClick={(event) => event.stopPropagation()}
              >
                {item.artistName}
              </Link>
            </article>
          ))}
        </TileRow>
      </section>

      <section className="home__section">
        <h2>آهنگ‌های پرشنونده</h2>
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
                  aria-label={isPlaying ? `توقف ${item.title}` : `پخش ${item.title}`}
                >
                  <img src={item.cover} alt="" />
                  {isPlaying ? (
                    <span className="home__playing">
                      <PlayingBars />
                      <span>در حال پخش</span>
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
                <Link to={artistPath(item.artistId)} className="home__tile-meta">
                  {item.artistName}
                </Link>
              </article>
            )
          })}
        </TileRow>
      </section>

      {isGold ? (
        <section className="home__section home__section--early">
          <h2>دسترسی زودهنگام</h2>
          <TileRow>
            {earlyAccessItems.map((item) => {
              if (item.kind === 'album') {
                return (
                  <article key={`ea-album-${item.id}`} className="home__tile">
                    <button
                      type="button"
                      className="home__tile-cover"
                      onClick={() => navigate(`/album/${item.id}`)}
                      aria-label={`باز کردن آلبوم ${item.title}`}
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
                    <Link to={artistPath(item.artistId)} className="home__tile-meta">
                      {item.artistName}
                    </Link>
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
                    aria-label={isPlaying ? `توقف ${item.title}` : `پخش ${item.title}`}
                  >
                    <img src={item.cover} alt="" />
                    {isPlaying ? (
                      <span className="home__playing">
                        <PlayingBars />
                        <span>در حال پخش</span>
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
                  <Link to={artistPath(item.artistId)} className="home__tile-meta">
                    {item.artistName}
                  </Link>
                </article>
              )
            })}
          </TileRow>
        </section>
      ) : null}
    </div>
  )
}
