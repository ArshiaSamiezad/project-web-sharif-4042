# Sepatify Backend

Django REST API for albums, tracks, and playlists (aligned with the frontend data shape).

## Setup

```bash
cd backend
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo
python manage.py runserver
```

API base: `http://127.0.0.1:8000/api/`

## Endpoints

### Users (read-only, for FK mapping)
- `GET /api/users/`
- `GET /api/users/{id}/`

### Albums
- `GET /api/albums/`
- `POST /api/albums/`
- `GET /api/albums/{id}/`
- `PATCH /api/albums/{id}/`
- `DELETE /api/albums/{id}/`
- `POST /api/albums/{id}/tracks/` — add a track to an album
- Query: `?artistId=`

### Tracks
- `GET /api/tracks/`
- `POST /api/tracks/`
- `GET /api/tracks/{id}/`
- `PATCH /api/tracks/{id}/`
- `DELETE /api/tracks/{id}/`
- Query: `?artistId=` `?albumId=` `?single=true`

### Playlists
- `GET /api/playlists/`
- `POST /api/playlists/`
- `GET /api/playlists/{id}/`
- `PATCH /api/playlists/{id}/` — rename / update cover
- `DELETE /api/playlists/{id}/`
- `POST /api/playlists/{id}/tracks/` — body: `{ "trackId": 1 }`
- `DELETE /api/playlists/{id}/tracks/{track_id}/`
- Query: `?ownerId=`

JSON field names match the frontend (`artistId`, `releasedAt`, `trackIds`, `audio`, …).

User model exists for relations; auth endpoints are intentionally not implemented in this phase.

## Frontend wiring

The React app loads albums/tracks/playlists from this API via `src/lib/api.js`.
Users are still local (Local Storage); emails must match `seed_demo` so `artistId`/`ownerId` can be mapped.

Run backend first, then:

```bash
npm run dev
```
