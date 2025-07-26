# Full-Stack Security Audit – finetuned-image-gen (Next.js / Prisma)

**Audit Date:** 2025-07-22

---
## Executive Summary
Overall the codebase follows many modern best-practices (server-only Prisma client, bcrypt hashing, session invalidation, etc.). No *critical* drop-everything flaws were found, but several **high/medium-severity issues** could lead to account takeover, stored XSS or privilege escalation if exploited.

### Key Findings
1. Path traversal & file-type spoofing in uploads
2. Missing rate-limiting / brute-force controls
3. Excessive Prisma query logging in production (PII leakage)
4. Missing global security headers & CSP
5. `dangerouslySetInnerHTML` injection without validation
6. Environment-wide secret scoping improvements

---
## Detailed Findings

### High Severity
| # | Issue | Location | Risk |
|---|-------|----------|------|
| 1 | **Path-Traversal & Stored-XSS Vector in Image Uploads** | `src/lib/upload.ts` (`saveImageToLocal`) | Attackers can craft malicious file names or upload HTML disguised as images, then access via public URL. |
| 2 | **Unauthenticated Asset Access / Bandwidth Abuse** | Various download & proxy routes | No signed URLs or expiry – hot-linking possible. |
| 3 | **SQL Query Logging in Production** | `src/lib/db.ts` | Logs full query parameters containing PII. |

### Medium Severity
| # | Issue | Risk |
|---|-------|------|
| 4 | Lack of rate-limiting & account lockout | Allows brute-force attacks on credentials & paid APIs. |
| 5 | Missing security headers (HSTS, CSP, X-Frame-Options, etc.) | Click-jacking & content-injection risk. |
| 6 | `dangerouslySetInnerHTML` without sanitisation | Potential reflected/stored XSS if prop ever becomes user-supplied. |
| 7 | Weak image MIME validation | Extension-only check – easy bypass. |
| 8 | Missing CSRF for non-NextAuth POST mutations | Confused-deputy attacks. |

### Low / Defense-in-Depth
- `trustHost: true` relies on upstream reverse-proxy configuration.
- Console env logging – ensure secrets never printed.
- Missing automated dependency scanning.

---
## Recommendations (Priority Order)
1. **Filestore Hardening**  
   • Sanitize filenames (slug or UUID) and validate magic-bytes.  
   • Store outside `public/` and serve via signed URLs.
2. **Disable Prisma Query Logging in Production**  
   ```ts
   new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['query'] : [] });
   ```
3. **Global Security Middleware** – Add strict security headers & CSP.
4. **Rate-Limit & Account-Lockout** – Use Upstash/Redis limiter on auth & generation routes.
5. **Validate `dangerouslySetInnerHTML` Inputs** – Regex-check GA tracking ID (`/^G-[A-Z0-9]+$/`).
6. **Add CSRF Defense for state-changing API routes**.
7. **Enable Dependabot / `npm audit` CI gate.**

---
## Positive Practices Observed
- Bcrypt (12 rounds) for password hashing
- Server-only Prisma usage guard (`./server-only`)
- Session invalidation support via `sessionInvalidatedAt`
- Parameterised queries (Prisma) mitigate SQLi
- Authentication middleware protecting dashboard routes
- Safe dynamic imports for Edge runtime

---
## Next Steps
- Open tasks for each High/Medium finding (Taskmaster).
- Schedule penetration test post-remediation.
- Add automated security CI & periodic audits.

---
*Prepared by: Staff Engineer – Security* 