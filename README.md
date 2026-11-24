# Pro Rinse Jobs

Personal offline-first PWA for logging window-cleaning jobs: properties, prices, photos, notes.

- **Stack:** Vite + React + TypeScript, Dexie (IndexedDB) for local storage, Supabase (Postgres + Storage + Auth) for backup/sync, vite-plugin-pwa for offline.
- **Supabase project:** `Pro Rinse Jobs` (ref `ldlocovxcrjtbtrzwnfo`). Tables `properties`, `jobs`, `photos`; private bucket `photos`. RLS = owner only. A trigger on `auth.users` blocks sign-ups after the first account.
- **Deploy:** push to `main` → GitHub Actions → GitHub Pages (`BASE_PATH=/pro-rinse-jobs/`).

## How sync works
1. Every edit writes to IndexedDB immediately with `dirty=1`.
2. When online (app open, on reconnect, every 60s, or 2.5s after an edit) dirty rows are upserted; photos upload to Storage first.
3. Then rows changed on the server since the last pull are pulled (local unsynced edits win).
4. Deletes are soft (`deleted=true`) so they sync too.

## Dev
```
npm install
npm run dev
```
