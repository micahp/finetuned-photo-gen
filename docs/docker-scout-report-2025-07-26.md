# Docker Scout CVE Report – 2025-07-26  

**Image analysed**: `finetuned-image-gen-dev:latest` (digest `c03e2217c4c4`)

| Severity | Count |
|----------|-------|
| Critical | **2** |
| High     | 2     |
| Medium   | 4     |
| Low      | 3     |

---

## Critical Findings & Immediate Fixes

| Package | Current | Fixed | CVE | Action |
|---------|---------|-------|-----|--------|
| `next`  | 15.1.8  | 15.2.3 | CVE-2025-29927 | `npm install next@15.2.3 --save` |
| `form-data` | 4.0.3 | 4.0.4 | CVE-2025-7783 | `npm install form-data@4.0.4 --save` |

After applying the above bumps, rebuild the image:
```bash
docker compose -f docker-compose.dev.yml build
```

---

## Base Image Recommendation

*Current*: `node:18-alpine` – 1 C / 3 H / 8 M CVEs.

*Suggested*: `node:24-alpine` (or `node:20-alpine` if breaking changes). Update all `FROM node:18.*-alpine` lines in the `Dockerfile`.

```bash
# Dockerfile snippet
-FROM node:18.19.1-alpine3.19 AS base
+FROM node:24-alpine AS base
```

Rebuild & scan again:
```bash
docker compose build
docker scout quickview finetuned-image-gen-app
```

---

## Remaining High / Medium Issues (indirect deps)

| Package | Current | Fixed | Severity |
|---------|---------|-------|----------|
| `ip` | 2.0.0 | _no fix_ | High |
| `cross-spawn` | 7.0.3 | 7.0.5 | High |
| `@babel/runtime` | 7.22.5 | 7.26.10 | Medium |
| `tar` | 6.2.0 | 6.2.1 | Medium |
| `brace-expansion` | 2.0.1 | 2.0.2 | Low |

Use **npm overrides** to pin:
```json
"overrides": {
  "cross-spawn": "7.0.5",
  "@babel/runtime": "7.26.10",
  "tar": "6.2.1",
  "brace-expansion": "2.0.2"
}
```

---

## Automation Suggestions

1. Add a CI step:
   ```bash
   docker scout quickview $CI_IMAGE --org your-org --format sarif > scout.sarif
   ```
   Fail the build if `critical > 0`.
2. Run `npm audit --omit=dev` during `npm ci` to catch runtime CVEs early.

---

*Generated automatically by ChatGPT Staff-Engineer bot on 2025-07-26T11:46 UTC.* 