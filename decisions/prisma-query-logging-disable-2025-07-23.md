# Decision – Disable Prisma Query Logging by Default (2025-07-23)

## Status
Accepted – implemented on 2025-07-23.

## Context
Prisma was instantiated with `{ log: ['query'] }`, causing every SQL statement to flood application logs. While helpful during local schema debugging, this output is excessive in production and CI, obscuring meaningful logs.

## Decision
* Remove the `log: ['query']` option from the `PrismaClient` constructor in `src/lib/db.ts`.
* Add a concise code comment explaining how to re-enable query logging temporarily (replace constructor with `new PrismaClient({ log: ['query'] })`).
* No environment flag introduced for now; the code comment is sufficient for developers.

## Consequences
* Production and test logs are significantly cleaner.
* Developers can still opt-in to detailed SQL output by editing one line locally.
* No runtime overhead or behaviour changes to Prisma.

## Follow-ups
* If frequent need arises, consider an env-flag approach (`PRISMA_QUERY_LOG=true`) wired via `process.env`.

## References
* Commit `3e83533` – *chore(prisma): disable query logging by default; add comment with instructions to re-enable*. 