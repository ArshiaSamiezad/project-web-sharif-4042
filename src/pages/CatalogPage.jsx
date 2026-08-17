import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePlaying } from '../context/PlayingContext'
import { useI18n } from '../i18n/I18nProvider'
import PlaylistMenu from '../components/PlaylistMenu'
import PlayingBars from '../components/PlayingBars'
import './CatalogPages.css'

function matchesQuery(text, query) {
  return String(text || '')
    .toLowerCase()
    .includes(query)
}

export default function CatalogPage() {
  const { getCatalog, getUserById } = useAuth()
  const { playingTrackId, playTrack } = usePlaying()
  const { t, formatNumber, language } = useI18n()
  const navigate = useNavigate()
  const catalog = getCatalog()

  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState('listeners')

  const normalizedQuery = query.trim().toLowerCase()

  // catalog.albums/tracks already come back early-access-filtered for this
  // viewer (see AuthContext.refreshCatalog, which passes ?userId= so the
  // backend's own access.ensure_early_access_allowed-backed filter applies)
  // — no plan/tier check needed here.
  const items = useMemo(() => {
    const albums = catalog.albums
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
  }, [catalog.albums, catalog.tracks, normalizedQuery, sortBy])

  function artistProfilePath(artistId) {
    const user = getUserById(artistId)
    return user?.username ? `/profile/${user.username}` : '/profile'
  }

  return (
    <div className="catalog">
      <header className="catalog__header">
        <div>
          <h1>{t('catalog.title')}</h1>
          <p>{t('catalog.subtitle')}</p>
        </div>
      </header>

      <div className="catalog__controls">
        <label className="catalog__search">
          <span className="visually-hidden">{t('common.search')}</span>
          <span className="catalog__search-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="11" cy="11" r="6.5" />
              <path d="M16.2 16.2 20 20" strokeLinecap="round" />
            </svg>
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('catalog.searchPlaceholder')}
            autoComplete="off"
          />
        </label>

        <div className="catalog__sort" role="group" aria-label={t('catalog.sort')}>
          <span className="catalog__sort-label">{t('catalog.sort')}</span>
          <div className="catalog__sort-track">
            <button
              type="button"
              className={`catalog__sort-opt${sortBy === 'listeners' ? ' is-active' : ''}`}
              aria-pressed={sortBy === 'listeners'}
              onClick={() => setSortBy('listeners')}
            >
              <span className="catalog__sort-opt-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M5 18V10M10 18V6M15 18v-5M20 18V8" strokeLinecap="round" />
                </svg>
              </span>
              {t('catalog.sortListeners')}
            </button>
            <button
              type="button"
              className={`catalog__sort-opt${sortBy === 'date' ? ' is-active' : ''}`}
              aria-pressed={sortBy === 'date'}
              onClick={() => setSortBy('date')}
            >
              <span className="catalog__sort-opt-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="4" y="5" width="16" height="15" rx="2" />
                  <path d="M8 3v4M16 3v4M4 10h16" strokeLinecap="round" />
                </svg>
              </span>
              {t('catalog.sortDate')}
            </button>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="catalog__empty">
          {t(normalizedQuery ? 'catalog.empty' : 'catalog.emptyCatalog')}
        </p>
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
                      aria-label={t('common.openAlbumAria', { title: item.title })}
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
                    <p className="catalog-card__meta-row">
                      <span className="catalog-card__kind">{t('common.album')}</span>
                      <span className="catalog-card__kind-sep" aria-hidden="true">
                        •
                      </span>
                      <Link
                        to={artistProfilePath(item.artistId)}
                        className="catalog-card__meta"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {item.artistName}
                      </Link>
                    </p>
                    {item.genre ? (
                      <p className="catalog-card__album">{item.genre}</p>
                    ) : null}
                    <p className="catalog-card__stat">
                      {t('common.listenerCount', {
                        count: formatNumber(item.listeners || 0),
                      })}
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
                    aria-label={
                      isPlaying
                        ? t('common.pauseAria', { title: item.title })
                        : t('common.playAria', { title: item.title })
                    }
                  >
                    <img src={item.cover} alt="" />
                    {isPlaying ? (
                      <span className="catalog-card__playing">
                        <PlayingBars />
                        <span>{t('common.nowPlaying')}</span>
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
                  <p className="catalog-card__meta-row">
                    <span className="catalog-card__kind">{t('common.single')}</span>
                    <span className="catalog-card__kind-sep" aria-hidden="true">
                      •
                    </span>
                    <Link to={artistProfilePath(item.artistId)} className="catalog-card__meta">
                      {item.artistName}
                    </Link>
                  </p>
                  {item.genre ? (
                    <p className="catalog-card__album">{item.genre}</p>
                  ) : null}
                  {Array.isArray(item.collaborators) && item.collaborators.length > 0 ? (
                    <p className="catalog-card__album">
                      {t('common.featuring', {
                        names: item.collaborators.join(language === 'en' ? ', ' : '، '),
                      })}
                    </p>
                  ) : null}
                  {album ? (
                    <Link to={`/album/${album.id}`} className="catalog-card__album">
                      {album.title}
                    </Link>
                  ) : null}
                  <p className="catalog-card__stat">
                    {t('common.listenerCount', {
                      count: formatNumber(item.listeners || item.plays || 0),
                    })}
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
