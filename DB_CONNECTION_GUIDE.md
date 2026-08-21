# ClaimPilot AI — Database Connection & Configuration Reference

This guide documents the different database connection options so you can quickly switch between the **Supabase Pooler**, **Direct PostgreSQL**, **Local SQLite**, or **Docker PostgreSQL** at any time.

---

## 1. Active Configuration: Supabase Connection Pooler (Recommended)
This is the active, verified connection method for cloud deployment and local development:

```ini
# in orchestrator/.env
DATABASE_URL=postgresql+asyncpg://postgres.pdnahhqqwgqcdfddsnly:Mk%40claimcopilotdb@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
```

* **Host**: `aws-0-ap-southeast-1.pooler.supabase.com`
* **Port**: `6543` (Transaction/Session Pooler)
* **Username**: `postgres.pdnahhqqwgqcdfddsnly`
* **Why**: Bypasses IPv4 direct routing restrictions on Supabase free tier and manages connection pools smoothly.

---

## 2. Direct PostgreSQL Connection (Standard URI)
If you ever want to connect directly to the standard host (port 5432):

```ini
# in orchestrator/.env
DATABASE_URL=postgresql+asyncpg://postgres:YOUR_PASSWORD@db.pdnahhqqwgqcdfddsnly.supabase.co:5432/postgres
```

* **Host**: `db.pdnahhqqwgqcdfddsnly.supabase.co`
* **Port**: `5432`
* **Username**: `postgres`
* **Important Note**: If your password contains special characters like `@`, `#`, or `/`, URL-encode them (e.g. `@` becomes `%40`).

---

## 3. Local SQLite (Offline Development / Testing)
If you ever want to run completely offline without internet:

```ini
# in orchestrator/.env
DATABASE_URL=sqlite+aiosqlite:///./claimpilot.db
```

---

## 4. Local Docker PostgreSQL
If running a local PostgreSQL container:

```bash
docker run --name claimpilot-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=claimpilot -p 5432:5432 -d postgres:16
```

```ini
# in orchestrator/.env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/claimpilot
```
