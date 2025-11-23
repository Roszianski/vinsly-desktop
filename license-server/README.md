# Vinsly License Server (Minimal)

This is a small HTTP service that Vinsly Desktop can call to activate and validate licence keys.

It exposes the endpoints described in `docs/desktop-license-auth.md`:

- `POST /api/license/activate`
- `POST /api/license/heartbeat`

and uses PostgreSQL to store:

- customers
- licences
- devices per licence

## 1. Setup

1. Create a Postgres database, e.g. `vinsly_license`.
2. Run the schema:

```bash
psql "$DATABASE_URL" -f schema.sql
```

3. Copy `.env.example` to `.env` and fill in:

- `DATABASE_URL` – connection string for your database.
- `JWT_SECRET` – long random string.
- `PORT` – e.g. `4000`.

4. Install dependencies and start the server:

```bash
cd license-server
npm install
npm run dev
```

The server will listen on `http://localhost:4000` by default.

## 2. Seeding licences

For a first pass, licences are created directly in the database. The Lemon Squeezy webhook route (`POST /webhooks/lemon`) is present but does not yet write to the DB.

To seed a licence manually:

1. Insert a customer row:

```sql
INSERT INTO customers (email) VALUES ('customer@example.com') RETURNING id;
```

2. Compute the SHA-256 hash of a Lemon Squeezy licence key (the string shown to the customer).

3. Insert a licence row using that hash:

```sql
INSERT INTO licenses (customer_id, license_key_hash, status, max_devices)
VALUES (<customer_id>, '<sha256-of-license-key>', 'active', 5);
```

The `/api/license/activate` endpoint will now accept that licence key.

## 3. Connecting from Vinsly Desktop

Set the frontend environment variable when building the desktop app:

```bash
VITE_LICENSE_SERVER_URL=https://api.vinsly.com  # or http://localhost:4000 for local dev
```

The desktop app’s activation flow will:

- POST to `/api/license/activate` on first activation.
- POST to `/api/license/heartbeat` on subsequent launches (once wired).

Once this is stable, the `/webhooks/lemon` route can be extended to upsert customers and licences automatically from Lemon Squeezy events.***

