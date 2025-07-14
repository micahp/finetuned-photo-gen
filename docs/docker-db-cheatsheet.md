# Docker Postgres Cheat-Sheet

> Quick reference for interacting with the **live** Postgres database that runs in this repo’s Docker Compose stack.
>
> Assumptions:
> 1. You’re in the project root (where `docker-compose.yml` is located).
> 2. Containers are already running via `docker compose up -d`.

---

## 1  Find / Inspect Containers

| Task | Command |
| ---- | ------- |
| List services & status | `docker compose ps` |
| Tail DB logs | `docker compose logs -f db` |
| Shell into Postgres container | `docker compose exec db sh` |

---

## 2  Connection Details

| Variable | Default (fallback) |
| -------- | ------------------ |
| `POSTGRES_DB` | `finetuned_photo_gen` |
| `POSTGRES_USER` | `postgres` |
| `POSTGRES_PASSWORD` | *(set in `.env`)* |
| `POSTGRES_PORT` | `5432` (bound to **127.0.0.1** only) |

**Connection URL template**

```text
postgresql://<user>:<password>@localhost:5432/<db>?schema=public
```

---

## 3  `psql` Quick-Start

### From host (psql client installed)

```bash
psql -h localhost -p 5432 -U $POSTGRES_USER $POSTGRES_DB
```

### From inside the container

```bash
docker compose exec db psql -U $POSTGRES_USER -d $POSTGRES_DB
```

### Handy meta-commands inside `psql`

```psql
\l           -- list databases
\dt          -- list tables
\d+ <table>  -- describe table
\q           -- quit
```

---

## 4  Basic SQL Examples

```sql
-- count users
SELECT COUNT(*) FROM users;

-- latest prompts
SELECT id, prompt, created_at
FROM generations
ORDER BY created_at DESC
LIMIT 10;

-- grant admin role
UPDATE users SET role = 'ADMIN' WHERE email = 'alice@example.com';
```

---

## 5  Safe Migrations (Prisma)

The **`migrate`** one-shot service runs automatically at start-up.

```bash
# Re-run pending migrations (production-safe)
docker compose run --rm migrate

# Push current schema (DEV ONLY)
npx prisma db push
```

---

## 6  Ad-hoc SQL Without `psql`

```bash
docker compose exec db \
  psql -U $POSTGRES_USER -d $POSTGRES_DB \
  -c "SELECT NOW();"
```

---

## 7  Backups & Restores

### Manual backup

```bash
# Creates compressed dump in ./backups

docker compose exec db \
  pg_dump -U $POSTGRES_USER -Fc $POSTGRES_DB \
  > backups/$(date +%F_%H-%M)-db.dump
```

### Manual restore (into SAME DB – make sure it’s empty!)

```bash
cat backups/2024-07-14_12-00-db.dump | \
  docker compose exec -T db \
  pg_restore -U $POSTGRES_USER -d $POSTGRES_DB --clean --if-exists
```

#### Smoke-test restore in disposable container

```bash
# spin up throw-away Postgres on port 55432

docker run --rm -e POSTGRES_PASSWORD=$POSTGRES_PASSWORD -p 55432:5432 postgres:15-alpine
# then restore & test
```

---

## 8  Health & Troubleshooting

```bash
# Check container health flag
docker inspect --format='{{json .State.Health}}' $(docker compose ps -q db) | jq

# Verify app can reach DB
curl -s http://localhost:3005/api/health
```

---

## 9  GUI Connection Snippet (PgAdmin / DBeaver)

```
Host      : localhost
Port      : 5432
Database  : finetuned_photo_gen
Username  : $POSTGRES_USER
Password  : $POSTGRES_PASSWORD
SSL       : disable (local only)
```

---

## 10  Trouble-shoot Flowchart

1. `docker compose ps` – is **db** `healthy`?
2. `docker compose logs db | tail` – obvious errors?
3. `docker compose exec db psql -U $POSTGRES_USER -d $POSTGRES_DB` – can you connect?
4. Check env inside app:
   ```bash
   docker compose exec app env | grep DATABASE_URL
   ```
5. Still stuck? Try re-running migration service.

---

> **Tip:** Keep this file open while working; 95 % of live-DB issues are solved with the commands above. 🚀 

---

## 11  Debugging “Can’t Log In” After a Rebuild

If the sign-in page just reloads or you get a 401/500 in `/api/auth/*`, use the checklist below. Run everything from the project root unless noted.

| Step | What to Do | Copy-Paste Command |
| --- | --- | --- |
| 1 | **Verify critical env vars are present in the running container.** | `docker compose exec app env | egrep 'NEXTAUTH_(URL|SECRET)|DATABASE_URL'` |
| 2 | **Watch real-time app logs while you click Log In.** | `docker compose logs -f app` |
| 3 | **Confirm the database URL actually works from inside the app container.** | `docker compose exec app npx prisma db push --skip-generate` (should exit 0) |
| 4 | **See if any users exist (the volume may have been wiped).** | `docker compose exec db psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT id,email FROM users LIMIT 5;"` |
| 5 | **Patch a test password (credential flow only).** | <details><summary>Commands</summary>

```bash
HASH=$(docker compose exec -T app node -e "console.log(require('bcryptjs').hashSync('test1234',10))")
docker compose exec db psql -U $POSTGRES_USER -d $POSTGRES_DB -c \
  "UPDATE users SET password='${HASH}' WHERE email='you@example.com';"
``` 
</details> |
| 6 | **Cookie / hostname mismatch?** Make sure `NEXTAUTH_URL` matches exactly the URL you browse at (incl. http/https & port). | — |
| 7 | **OAuth provider keys** present? Check env for `GOOGLE_CLIENT_ID` etc. | `docker compose exec app env | grep CLIENT_ID` |

> **Tip:** Almost every login failure after a fresh `docker compose up --build` is one of these: missing `NEXTAUTH_SECRET`, empty `users` table, or hostname mismatch in `NEXTAUTH_URL`. 