# Video Feature Database Migration Guide (PR #11)

> **Status:** Draft ‑ waiting for PR #11 merge into `dev`
>
> **Applies to migrations:**
> - `20250626141646_add_video_generation/`
> - `20250607162550_add_credit_idempotency_constraints/` *(renames columns to camelCase)*
> - Any earlier pending migrations on your environment

---

## 1. Overview
This guide describes the **safe rollout procedure** for the new database changes required by the *text-to-video & image-to-video* feature.  It follows the safety rules defined in [`DATABASE_BACKUP_GUIDE.md`](../DATABASE_BACKUP_GUIDE.md) and user Rule 15:

1. Back up the production database before *any* destructive operation.
2. Apply migrations on a **staging clone first** and run smoke tests.
3. Promote to production after sign-off.

---

## 2. Prerequisites

| Requirement | Notes |
|-------------|-------|
| PostgreSQL ≥ 15 | `gen_random_uuid()` in the new SQL uses **pgcrypto** extension.  Enable it if not present: `CREATE EXTENSION IF NOT EXISTS pgcrypto;` |
| Prisma CLI v5.15+ | `npx prisma -v` |
| Environment variables | `DATABASE_URL`, plus any Fal.ai credentials for smoke tests |
| Backup directory | Confirm `./backups/` has ≥ 2× DB size free space |

---

## 3. Migration Contents

### 3.1 `20250626141646_add_video_generation`
* Creates `videos` table to store video jobs & metadata
* Adds FK relations to `users` & `models`
* Adds indexes on `(userId, createdAt)` and `(status)`

### 3.2 `20250607162550_add_credit_idempotency_constraints`
* Introduces `creditTransactions` table with unique `idempotencyKey`
* Renames column `purchased_credit_packs` ➜ `"purchasedCreditPacks"` *(camelCase quoted)*
* Adds partial unique index to prevent duplicate credit rolls

---

## 4. Checklist **before** Production

- [ ] Local dev DB up-to-date (`npx prisma migrate dev`)
- [ ] CI green on branch `feat/video`
- [ ] Staging database cloned from latest prod snapshot
- [ ] `pgcrypto` extension enabled on staging
- [ ] Smoke tests (Section 6) pass on staging
- [ ] Rollback script tested on staging (Section 5)

---

## 5. Rollback Strategy

The migrations are **forward-only** (Prisma can’t drop renamed columns).  Rollback path is therefore *restore-from-backup*:

```bash
# 1  Stop application traffic
kubectl scale deployment web --replicas=0  # example

# 2  Restore last backup
gunzip -c backups/backup_20250701_010101.sql.gz | psql $DATABASE_URL

# 3  Restart services
kubectl scale deployment web --replicas=3
```

Test this on staging before you need it!

---

## 6. Migration Procedure

### 6.1 Backup Production
```bash
./scripts/backup-db.sh  # Creates timestamped .sql.gz in ./backups/
```
Verify completion:
```bash
./scripts/backup-status.sh
```

### 6.2 Deploy Code → Staging
```bash
git checkout dev && git pull origin dev
git merge --no-ff origin/feat/video  # or after PR merge
docker compose -f docker-compose.dev.yml up -d --build
```

### 6.3 Apply Migrations (Staging)
```bash
npx prisma migrate deploy  # uses schema.prisma in repo
```

### 6.4 Run Smoke Tests
See Section 7.

### 6.5 Promote to Production
1. Put site into maintenance mode (optional).
2. Run the same migration command against the prod DB:
   ```bash
   npx prisma migrate deploy --schema=prisma/schema.prisma \
     --env-file=.env.production
   ```
3. Redeploy application containers / serverless functions.
4. Remove maintenance mode.

---

## 7. Smoke-Test Suite
Perform these checks **after** migrations:

| Test | Command | Expected |
|------|---------|----------|
| Prisma client connectivity | `node scripts/debug/check_model_status.js` | ✅ OK |
| Credit transaction insert | `node scripts/add-credits.js --user test --amount 1` | Returns 200 & row in `creditTransactions` |
| Video generation job (mock) | `npm run test video:integration` | Pass |
| API health | `curl -f https://staging.yourapp.com/api/health` | `200 OK` |

For quick manual DB verification:
```sql
-- Verify new tables
\d+ videos;
\d+ creditTransactions;

-- Confirm default data counts
SELECT COUNT(*) FROM videos WHERE status = 'pending';
```

---

## 8. Post-Migration Tasks

1. **Vacuum & Analyze** new tables (Postgres auto-analyzes, but force when large seeds):
   ```bash
   VACUUM ANALYZE videos;
   VACUUM ANALYZE creditTransactions;
   ```
2. **Update monitoring dashboards** to include `videos` table size & row count.
3. **Rotate backups** – ensure new tables are included.

---

## 9. Troubleshooting

| Symptom | Possible Cause | Fix |
|---------|----------------|-----|
| `ERROR: function gen_random_uuid() does not exist` | `pgcrypto` not enabled | `CREATE EXTENSION pgcrypto;` |
| `duplicate key value violates unique constraint "creditTransactions_idempotencyKey_key"` | Client retried with same key | Ensure idempotencyKey truly unique; handle 409 on client |
| API returns `Prompt too long` after deploy | Env mismatch – old pods still running | Redeploy all web pods |

---

### Questions?
Ping `#db-ops` on Slack or @micahp in GitHub comments. 