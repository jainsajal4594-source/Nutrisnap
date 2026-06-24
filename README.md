# NutriSnap — backend

A small Express server that turns the static NutriSnap demo into a real app:

- **Auth** — signup/login/logout with hashed passwords (bcrypt) and an
  httpOnly session cookie (JWT). No passwords or tokens ever touch
  `localStorage`.
- **Diary persistence** — logged-in users' meal diary and calorie goal are
  stored server-side and survive across devices/sessions. Guests get a
  diary that works immediately but only lives in memory for that page visit
  (matches the original "try it instantly, sign up to save" UX).
- **AI proxy** — your Gemini API key lives only in this server's `.env`
  file. The browser never sees it; it calls `/api/ai/...` and the server
  forwards the request to Gemini.

## 1. Install

Requires Node.js 18 or newer (for built-in `fetch` and `crypto.randomUUID`).

```bash
cd nutrisnap-app
npm install
```

## 2. Configure

```bash
cp .env.example .env
```

Then edit `.env`:

- `GEMINI_API_KEY` — get a free one at https://aistudio.google.com/apikey
- `JWT_SECRET` — any long random string. Generate one with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
- `PORT` — defaults to 3000
- `NODE_ENV` — leave as `development` locally; set to `production` when deployed (this makes session cookies `secure`, i.e. HTTPS-only)

## 3. Run

```bash
npm start
```

Visit **http://localhost:3000** — the frontend (`public/index.html`) and the
API are served from the same server, so there's nothing else to wire up.

For auto-restart on file changes during development:

```bash
npm run dev
```

## How data is stored

`src/db.js` is a tiny JSON-file database (`data/db.json`), created
automatically on first run. It's fine for a demo or a small number of
users, but:

- **It is not safe for concurrent production traffic** (no locking, no
  transactions).
- **Most hosting platforms wipe the local filesystem on every deploy**
  (Render, Railway, Vercel, Fly.io's ephemeral volumes, etc.), so
  `data/db.json` will reset unless you mount a persistent volume or — better
  — swap in a real database.

Every other file talks to storage only through the functions exported by
`db.js` (`createUser`, `getDiary`, `addMeal`, etc.), so migrating to
Postgres/MySQL/MongoDB later just means rewriting that one file.

## API summary

| Method | Path                  | Auth required | Purpose                          |
|--------|-----------------------|----------------|-----------------------------------|
| POST   | /api/auth/signup      | no             | Create account, starts a session  |
| POST   | /api/auth/login       | no             | Log in, starts a session          |
| POST   | /api/auth/logout      | no             | Clear the session cookie          |
| GET    | /api/auth/me          | yes            | Get the logged-in user            |
| GET    | /api/diary            | yes            | Get today's diary + goal          |
| POST   | /api/diary/meals      | yes            | Add a meal                        |
| DELETE | /api/diary/meals/:id  | yes            | Remove a meal                     |
| PUT    | /api/diary/goal       | yes            | Update daily calorie goal         |
| POST   | /api/ai/analyze-food  | no (rate-limited) | Analyze a food photo           |
| POST   | /api/ai/chat          | no (rate-limited) | Chat with the nutrition assistant |

The AI routes are intentionally open to guests (same as the original demo)
but capped at **30 requests/hour per IP** (see `src/middleware/rateLimit.js`)
so a public deployment can't be used to silently burn through your Gemini
quota. Tighten this, or change `optionalAuth` to `requireAuth` in
`src/routes/ai.js` if you'd rather only logged-in users get AI access.

## Deploying

Any Node host works (Render, Railway, Fly.io, a VPS, etc.):

1. Push this folder to your host.
2. Set `GEMINI_API_KEY`, `JWT_SECRET`, and `NODE_ENV=production` as
   environment variables in the host's dashboard (don't commit `.env`).
3. Build/start command: `npm install && npm start`.
4. If your host supports persistent disks/volumes, mount one at `./data` so
   `db.json` survives redeploys — otherwise plan to migrate to a real
   database before relying on this for real users.

## Things worth doing before real production use

- Swap `src/db.js` for a real database (Postgres is a solid default).
- Resize/compress photos client-side before upload — right now a full-res
  phone photo is sent as base64, which is slower and uses more of your
  Gemini quota than necessary.
- Add email verification / password-reset flows if you want this to be a
  real consumer auth system rather than a demo-grade one.
- Consider moving the in-memory rate limiter to Redis if you ever run more
  than one server instance.
