import { useAuth } from '../context/AuthContext'
import './HomePage.css'

export default function HomePage() {
  const { currentUser, getCatalog } = useAuth()
  const catalog = getCatalog()

  const recentPlaylists = (currentUser.recentPlaylistIds || [])
    .map((id) => catalog.playlists.find((p) => p.id === id))
    .filter(Boolean)

  const latestAlbums = [...catalog.albums].sort((a, b) =>
    b.releasedAt.localeCompare(a.releasedAt),
  )

  const popularTracks = [...catalog.tracks]
    .filter((t) => !t.earlyAccess)
    .sort((a, b) => b.plays - a.plays)

  const earlyAccessItems = [
    ...catalog.albums.filter((a) => a.earlyAccess),
    ...catalog.tracks.filter((t) => t.earlyAccess),
  ]

  const isGold = currentUser.subscription === 'gold'

  return (
    <div className="home">
      <section className="home__section">
        <h2>آخرین پلی‌لیست‌های شنیده‌شده</h2>
        <div className="home__row">
          {recentPlaylists.map((item) => (
            <article key={item.id} className="home__tile">
              <img src={item.cover} alt="" />
              <h3>{item.title}</h3>
            </article>
          ))}
        </div>
      </section>

      <section className="home__section">
        <h2>آخرین آلبوم‌های منتشرشده</h2>
        <div className="home__row">
          {latestAlbums.map((item) => (
            <article key={item.id} className="home__tile">
              <img src={item.cover} alt="" />
              <h3>{item.title}</h3>
              <p>{item.artistName}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home__section">
        <h2>آهنگ‌های پرشنونده</h2>
        <div className="home__row">
          {popularTracks.map((item) => (
            <article key={item.id} className="home__tile">
              <img src={item.cover} alt="" />
              <h3>{item.title}</h3>
              <p>{item.artistName}</p>
            </article>
          ))}
        </div>
      </section>

      {isGold ? (
        <section className="home__section home__section--early">
          <h2>دسترسی زودهنگام</h2>
          <div className="home__row">
            {earlyAccessItems.map((item) => (
              <article key={item.id} className="home__tile">
                <img src={item.cover} alt="" />
                <h3>{item.title}</h3>
                <p>{item.artistName}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
