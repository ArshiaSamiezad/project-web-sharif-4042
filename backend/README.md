# Sepatify Backend

Django REST API for albums, tracks, playlists, and media uploads.

## Setup

```bash
cd backend
python -m pip install -r requirements.txt
copy .env.example .env   # set GEMINI_API_KEY
python manage.py migrate
python manage.py seed_demo
python manage.py runserver
```

API base: `http://127.0.0.1:8000/api/`
Media files: `http://127.0.0.1:8000/media/` (stored under `backend/media/`)

Gemini recommendations need `GEMINI_API_KEY` in `backend/.env` (see `.env.example`).

## Media layout

| Type | Path |
|------|------|
| User avatars | `media/avatars/<user_id>/` |
| Album covers | `media/covers/albums/<artist_id>/` |
| Track covers | `media/covers/tracks/<artist_id>/` |
| Playlist covers | `media/covers/playlists/<owner_id>/` |
| Audio files | `media/audio/<artist_id>/` |

Accepted images: JPEG / PNG
Accepted audio: MP3 / WAV / FLAC

Upload with `multipart/form-data`. Response fields `cover`, `avatar`, and `audioUrl` are absolute URLs.

## Endpoints

### Users
- `GET /api/users/`
- `GET /api/users/{id}/`
- `PATCH /api/users/{id}/` — upload `avatar` file

### Albums
- CRUD + `POST /api/albums/{id}/tracks/`
- Optional file field: `cover`

### Tracks
- CRUD
- Write file field: `audioFile` (required on create)
- Optional file field: `cover`
- Read: `audioUrl`, `audio` (`{name,size,type}`)

### Playlists
- CRUD + add/remove tracks
- Optional file field: `cover`
- `POST /api/playlists/{id}/recommend/` — Gemini picks 10 catalog track IDs (UI shows 5, keeps 5 in reserve)

## Frontend

Vite proxies `/api` and `/media` to Django. Run backend first, then `npm run dev`.
