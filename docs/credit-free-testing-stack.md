Below is a pragmatic “credit-free” testing stack that I’ve seen work well when you’re wiring Replicate (image) + Fal (video) into a TypeScript or Python codebase.  It keeps the business logic honest while burning **≈ $0** in compute.

---

## 0. Isolate the expensive bits

* Design a thin **Provider Adapter** interface (`generateImage()`, `generateVideo()`, `cancelJob()`, etc.).
* Keep all prompt-assembly, polling, retry, and streaming logic **inside** that adapter so the rest of your app can be unit-tested without touching the network.

---

## 1. Unit-test parameter building (no network)

1. Fetch each model’s OpenAPI schema once and commit it as a fixture.

   * Replicate: `GET /v1/models/{owner}/{model}` → `latest_version.openapi_schema`
   * Fal:  `GET https://docs.fal.ai/model-endpoints/openapi.json` (or scrape the endpoint-specific docs)

2. Validate every request object locally with `ajv` (TS) or `jsonschema` (Py).
3. Write normal Jest / Pytest unit tests that mutate inputs and assert “schema valid / invalid”.

Because you never hit `predictions.create`, this step is completely free.

---

## 2. Contract tests with **real** JSON but **no GPU time**

### Replicate

```text
GET /v1/models/{owner}/{model}/examples
```

returns full prediction objects (inputs + outputs) that cost nothing because you’re only downloading metadata — no model run required.  Use these as canonical fixtures in tests. ([Replicate][1])

### Fal

Fal’s docs include runnable snippets under “Testing → Ephemeral Deployments.” Spin one up once, save the JSON response, then tear it down.  The JSON lives on as a fixture; the GPU goes away. ([fal.ai Docs][2])

---

## 3. Mock the HTTP layer during CI / local dev

| Language          | Library                                    | One-liner example                                                                            |
| ----------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| TypeScript / Node | **MSW** (browser+node) or **nock**         | `rest.post('https://api.replicate.com/v1/predictions', (_req,res,ctx)=>res(ctx.json(mock)))` |
| Python            | **responses** (requests) or **httpx-mock** | `responses.add(responses.POST, REPLICATE_URL, json=mock_pred)`                               |

Because the fixture already looks exactly like a real Replicate / Fal response, you’re testing deserialisation, status transitions, polling loops, SSE streams, etc., without paying for inference.

---

## 4. Run an **open-source fallback model locally**

| Task                 | Lightweight stand-in                                                       | How to integrate                                                                                          |
| -------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Text → Image         | **Stable Diffusion Turbo** (`diffusers`, CPU-friendly)                     | Map your adapter so `provider==='local'` runs SD-Turbo and returns the same JSON shape as Replicate.      |
| Image / Text → Video | **Stable Video Diffusion** or **AnimateDiff** (works on a single RTX 3060) | Return a fake “job-id” immediately, then save the MP4 to `/tmp` so your pipeline thinks it came from Fal. |

---

## 5. Record-and-replay (“VCR”) for the rare live call

When you *must* hit the real API (e.g., golden-master visual tests):

1. Set an env var `LIVE_INFERENCE=1`.
2. Wrap the HTTP client with an on-disk cassette (‐- nock-record / betamax / vcrpy).
3. Next run, replay the cassette instead of paying again.

---

## 6. Be careful with “cheap” tricks that still cost

* **Cancelling** a Replicate run doesn’t always save money; official models can still bill for elapsed GPU time. ([Replicate][3])
* Fal does not bill 5xx failures, **but** user-errors (HTTP 422) *are* charged.  Don’t rely on “intentional failure” tests. ([fal.ai Docs][4])

---

## 7. Optional sanity smoke-tests (pennies, not dollars)

* Hit Replicate’s smallest/fastest model (`black-forest-labs/flux-schnell` at $0.003 / MP) once per release.
* Use Fal’s shortest clip (`duration=2 s`) and lowest resolution (`512×288`) with an inexpensive model like MiniMax.  A single end-to-end run costs < $0.10, which is acceptable as a nightly check.

---

### TL;DR

1. **Schema-validate** inputs locally.
2. **Fixture-mock** outputs with free metadata calls.
3. **Intercept** HTTP with MSW / responses.
4. **Swap-in open-source** models for heavy tests.
5. Only **touch the real GPU** for a tiny smoke-test.

Follow that flow and your automated test suite will exercise every branch of your generation logic while your credit balance stays essentially untouched.

[1]: https://replicate.com/docs/reference/http "HTTP API - Replicate docs"
[2]: https://docs.fal.ai/private-serverless-apps/testing/ "Testing | fal.ai Private Apps | fal.ai Docs"
[3]: https://replicate.com/docs/topics/billing?utm_source=chatgpt.com "Billing - Replicate docs"
[4]: https://docs.fal.ai/faq/ "FAQ | fal.ai Documentation | fal.ai Docs" 