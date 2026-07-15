import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePlaying } from '../context/PlayingContext'
import PlaylistMenu from '../components/PlaylistMenu'
import PlayingBars from '../components/PlayingBars'
import './CatalogPages.css'

function matchesQuery(text, query) {
  return String(text || '')
    .toLowerCase()
    .includes(query)
}

export default function CatalogPage() {
  const { currentUser, getCatalog, getUserById } = useAuth()
  const { playingTrackId, playTrack } = usePlaying()
  const navigate = useNavigate()
  const catalog = getCatalog()

  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState('listeners')

  const isGold = currentUser?.subscription === 'gold'
  const normalizedQuery = query.trim().toLowerCase()

  const items = useMemo(() => {
    const albums = catalog.albums
      .filter((album) => isGold || !album.earlyAccess)
      .filter((album) => {
        if (!normalizedQuery) return true
        return (
          matchesQuery(album.title, normalizedQuery) ||
          matchesQuery(album.artistName, normalizedQuery)
        )
      })
      .map((album) => ({ kind: 'album', ...album }))

    const singles = catalog.tracks
      .filter((track) => !track.albumId)
      .filter((track) => isGold || !track.earlyAccess)
      .filter((track) => {
        if (!normalizedQuery) return true
        return (
          matchesQuery(track.title, normalizedQuery) ||
          matchesQuery(track.artistName, normalizedQuery)
        )
      })
      .map((track) => ({ kind: 'single', ...track }))

    const merged = [...albums, ...singles]

    merged.sort((a, b) => {
      if (sortBy === 'date') {
        return String(b.releasedAt || '').localeCompare(String(a.releasedAt || ''))
      }
      const aValue = a.kind === 'album' ? a.listeners || 0 : a.listeners || a.plays || 0
      const bValue = b.kind === 'album' ? b.listeners || 0 : b.listeners || b.plays || 0
      return bValue - aValue
    })

    return merged
  }, [catalog.albums, catalog.tracks, isGold, normalizedQuery, sortBy])

  function artistProfilePath(artistId) {
    const user = getUserById(artistId)
    return user?.username ? `/profile/${user.username}` : '/profile'
  }

  return (
    <div className="catalog">
      <header className="catalog__header">
        <div>
          <h1>آلبوم‌ها و تک‌آهنگ‌ها</h1>
          <p>جستجو و کشف موسیقی در آرشیو سپتیفای</p>
        </div>
      </header>

      <div className="catalog__controls">
        <label className="catalog__search">
          <span className="visually-hidden">جستجو</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="جستجو بر اساس نام اثر یا هنرمند…"
            autoComplete="off"
          />
        </label>

        <label className="catalog__sort">
          <span>مرتب‌سازی</span>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            <option value="listeners">تعداد شنونده</option>
            <option value="date">تاریخ انتشار</option>
          </select>
        </label>
      </div>

      {items.length === 0 ? (
        <p className="catalog__empty">موردی با این جستجو پیدا نشد.</p>
      ) : (
        <div className="catalog__grid">
          {items.map((item) => {
            if (item.kind === 'album') {
              return (
                <article key={`album-${item.id}`} className="catalog-card catalog-card--album">
                  <div className="catalog-card__media">
                    <button
                      type="button"
                      className="catalog-card__cover-btn"
                      onClick={() => navigate(`/album/${item.id}`)}
                      aria-label={`باز کردن آلبوم ${item.title}`}
                    >
                      <img src={item.cover} alt="" />
                    </button>
                    <div className="catalog-card__menu">
                      <PlaylistMenu mode="album" albumId={item.id} />
                    </div>
                  </div>
                  <div className="catalog-card__body">
                    <button
                      type="button"
                      className="catalog-card__title"
                      onClick={() => navigate(`/album/${item.id}`)}
                    >
                      {item.title}
                    </button>
                    <Link
                      to={artistProfilePath(item.artistId)}
                      className="catalog-card__meta"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {item.artistName}
                    </Link>
                    <p className="catalog-card__stat">
                      {(item.listeners || 0).toLocaleString('fa-IR')} شنونده
                    </p>
                  </div>
                </article>
              )
            }

            const album = item.albumId
              ? catalog.albums.find((a) => a.id === item.albumId)
              : null
            const isPlaying = playingTrackId === item.id

            return (
              <article
                key={`single-${item.id}`}
                className={`catalog-card catalog-card--single${isPlaying ? ' is-playing' : ''}`}
              >
                <div className="catalog-card__media">
                  <button
                    type="button"
                    className="catalog-card__cover-btn"
                    onClick={() => playTrack(item.id)}
                    aria-label={isPlaying ? `توقف ${item.title}` : `پخش ${item.title}`}
                  >
                    <img src={item.cover} alt="" />
                    {isPlaying ? (
                      <span className="catalog-card__playing">
                        <PlayingBars />
                        <span>در حال پخش</span>
                      </span>
                    ) : (
                      <span className="catalog-card__play-hint" aria-hidden="true">
                        ▶
                      </span>
                    )}
                  </button>
                  <div className="catalog-card__menu">
                    <PlaylistMenu mode="track" trackId={item.id} />
                  </div>
                </div>
                <div className="catalog-card__body">
                  <button
                    type="button"
                    className="catalog-card__title"
                    onClick={() => playTrack(item.id)}
                  >
                    {item.title}
                  </button>
                  <Link to={artistProfilePath(item.artistId)} className="catalog-card__meta">
                    {item.artistName}
                  </Link>
                  {album ? (
                    <Link to={`/album/${album.id}`} className="catalog-card__album">
                      {album.title}
                    </Link>
                  ) : null}
                  <p className="catalog-card__stat">
                    {(item.listeners || item.plays || 0).toLocaleString('fa-IR')} شنونده
                  </p>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
