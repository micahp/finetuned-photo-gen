# CI/CD Upgrade Plan

**Date:** 2025-07-26

We currently validate only Docker builds in CI.  The following improvements are deferred until the test suite is updated but are captured here for future implementation.

## Planned Pipeline Stages

1. **Code Quality & Correctness**
   - ESLint / Prettier lint check.
   - `tsc --noEmit` type-check.
   - Jest unit & integration tests.
   - Playwright e2e smoke tests.

2. **Security & Dependency Hygiene**
   - `pnpm audit` (or `npm audit`) in CI.
   - Container vulnerability scan (Trivy or Grype) on built image.
   - Secret-leak scanner (e.g., gitleaks) on codebase.

3. **Build Artifacts & Reporting**
   - `next build` static build check.
   - Upload coverage reports / dist bundles as workflow artifacts.

4. **Docker Image Promotion**
   - Re-run production image build on `main` after tests pass with `push: true`.
   - Tag strategy: `latest`, commit SHA, optional semver/date tags.

5. **Deployment & Rollout (CD)**
   - Trigger Fly.io / Render / k8s deployment once image is pushed.
   - Use GitHub environments and required reviewers to gate production deploys.

6. **Misc Improvements**
   - Matrix build for multi-arch (`linux/amd64`, `linux/arm64`).
   - Separate node-modules cache to speed non-Docker jobs.
   - Slack / Discord notifications on failure.

## Next Steps

1. Refactor / update the existing test suite to green.
2. Introduce a `ci.yml` workflow implementing stage 1 above.
3. Incrementally add stages 2-6 as readiness and secrets setup allow.

---
*Created automatically to preserve context for future CI/CD enhancements.* 