# JR Japanese Railway Term Extraction

Web app for uploading Japanese railway documents and extracting specialist terms with the BERT pipeline trained in the notebook.

## 1. Initialize Neon

Create a Neon PostgreSQL project, open its SQL editor, and run the complete contents of:

[`server/db/init.sql`](server/db/init.sql)

Run this initial schema once for a new database. Future changes to a database that already contains customer review data must use a versioned migration instead of editing and re-running `init.sql`.

Use a separate Neon project for development and production. The backend is the only component allowed to receive `DATABASE_URL`; never expose it through a `VITE_` variable or frontend code.

## 2. Run locally with Neon

```bash
npm run install:all
cp server/.env.example server/.env
# Edit server/.env and set DATABASE_URL and SESSION_SECRET.
npm run dev
```

Frontend: http://localhost:5173

Backend API: http://localhost:4000

Local login: `operator` / `jr-local-review`

For local PostgreSQL without TLS, explicitly set `DATABASE_SSL=disable`. Neon connections use certificate verification by default.

The health endpoint reports both `databaseConfigured` and `databaseAvailable`. The latter becomes `true` only after the database is reachable and `init.sql` has been applied.

The local account is available only when `AUTH_USERS` is not configured.

## Configure customer accounts

Generate a password hash without storing the password in source code:

```bash
npm run auth:hash --prefix server -- 'customer-password'
```

Start the server with one or more issued accounts:

```bash
AUTH_USERS='[{"username":"customer01","name":"確認担当者","passwordHash":"scrypt$..."}]' \
SESSION_SECRET='replace-with-a-long-random-secret' \
DATABASE_URL='postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require' \
DOCUMENT_STORAGE_DIR='/srv/jr-term-review/documents' \
CLIENT_ORIGIN='http://localhost:5173' \
npm run start --prefix server
```

Authentication uses a signed, `HttpOnly`, `SameSite=Strict` session cookie. The extraction endpoint rejects unauthenticated requests before accepting uploaded files. Use HTTPS in production so the cookie is also marked `Secure`.

Production startup fails unless `AUTH_USERS`, `SESSION_SECRET`, and `DATABASE_URL` are configured.

## Data storage

- Neon stores extraction metadata, normalized terms, source evidence sentences, review decisions, optimistic-lock versions, and append-only review history.
- Original PDF, DOCX, and TXT bytes are not stored in Neon. They are retained under `DOCUMENT_STORAGE_DIR` so reviewers can reopen source pages in later sessions.
- Stored files use random UUID names, directory permission `0700`, and file permission `0600`. Source content is served only through an authenticated API.
- Back up Neon with a scheduled encrypted `pg_dump` to independent AI4LIFE storage. Back up the private document directory under a separate retention policy.
- Configure Neon IP Allow so only the fixed outbound IP of the AI4LIFE server can connect when that IP is available.

## Review and training export

Review decisions are global per NFKC-normalized term:

- `unreviewed`: not reviewed yet
- `approved`: confirmed JR specialist term
- `rejected`: not a JR specialist term
- `uncertain`: needs further discussion

Every change records the reviewer, timestamp, previous/new state, note, and version. Concurrent stale updates return HTTP `409` instead of overwriting another reviewer.

CSV and JSONL training exports include only `approved` positive examples and `rejected` negative examples. `unreviewed` and `uncertain` terms are excluded from the training dataset.

## Verification

```bash
npm test --prefix server
npm run build --prefix client
```

## Supported Uploads

- `.txt`
- `.pdf`
- `.docx`

PDF and DOCX extraction is handled in Node before the text is sent to the Python term extraction pipeline.
