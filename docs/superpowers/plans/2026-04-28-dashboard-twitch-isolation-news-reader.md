# Dashboard Twitch Isolation + News Text Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Twitch live correctness, prevent side-panel player restarts during unrelated dashboard actions, and add AI News raw-text popup with fallback to source URL.

**Architecture:** Keep dashboard cache-first for speed, make Twitch cron authoritative for live truth, isolate UI state by selected stream identity, and fetch/sanitize article text on backend before rendering in a dedicated popup.

**Tech Stack:** Node/Express, Prisma (SQLite), Angular 21 standalone components + signals, RxJS, Vitest, Jest.

---

## File Structure and Responsibilities

- `server/src/services/twitch.service.ts`
  - Authoritative Twitch live set reconciliation and stale-live prevention.
  - Fast cache-first read path for dashboard.
- `server/src/services/aggregator.service.ts`
  - Dashboard composition uses Twitch fast path and preserves startup latency.
- `server/src/routes/api.routes.ts`
  - SSE stream heartbeat stability.
  - New article extraction endpoint exposure.
- `server/src/services/news.service.ts`
  - Raw-text article extraction and sanitization.
- `src/app/pages/dashboard/dashboard.component.ts`
  - Isolate section refreshes and preserve selected stream playback identity.
- `src/app/components/stream/stream-player-panel.component.ts`
  - Keep player mounted/stable for same stream id.
- `src/app/components/sections/news-section.component.ts`
  - Article click behavior to open raw-text popup.
- `src/app/components/news-article-reader-popup/news-article-reader-popup.component.ts` (new)
  - Popup rendering title/source/plain text body.
- `src/app/services/api.service.ts`
  - API method for article raw-text fetch.
- `server/src/services/twitch.service.test.ts`
- `server/src/services/aggregator.service.test.ts`
- `server/src/routes/api.routes.test.ts`
- `server/src/services/news.service.test.ts`
- `src/app/pages/dashboard/dashboard.component.spec.ts`
- `src/app/components/sections/news-section.component.spec.ts` (create if missing)
- `docs/tests/2026-04-28-dashboard-functional-test-book.md` (new, functional step-by-step execution)

---

### Task 1: Lock Twitch Live Truth Rules in Tests (Red)

**Files:**
- Modify: `server/src/services/twitch.service.test.ts`
- Test: `server/src/services/twitch.service.test.ts`

- [ ] **Step 1: Add failing test for “ended live removed at next authoritative refresh”**

Add a test that seeds cached live entries, mocks Twitch response without one channel, runs `refreshLiveCacheLight()`, and asserts ended channel becomes `isLive=false`.

- [ ] **Step 2: Add failing test for “fresh cache only” in fast read path**

Add a test ensuring `getLiveStreamsFast()` does not return old `fetchedAt` rows.

- [ ] **Step 3: Run targeted test to verify failure first**

Run:
```bash
cd /home/dev/nighthub/server && npm run test -- src/services/twitch.service.test.ts
```
Expected: new tests fail before implementation updates.

---

### Task 2: Implement Twitch Live Reconciliation + Fast Cache Reads (Green)

**Files:**
- Modify: `server/src/services/twitch.service.ts`
- Test: `server/src/services/twitch.service.test.ts`

- [ ] **Step 1: Implement authoritative reconciliation behavior**

In `refreshLiveCacheLight()`:
- compute current live set from Twitch response,
- mark missing cached live rows as ended (`isLive=false`),
- refresh timestamps for still-live rows,
- keep return payload (`changed/newLives/endedLives/totalLive`) consistent.

- [ ] **Step 2: Ensure fast path only returns fresh live cache**

In `getCachedStreams()`:
- filter by `isLive=true`,
- add freshness window filter by `fetchedAt`,
- keep sort by newest `fetchedAt`.

- [ ] **Step 3: Keep dashboard speed via background refresh trigger**

In `getLiveStreamsFast()`:
- return cache immediately,
- schedule refresh only if stale and no in-flight refresh.

- [ ] **Step 4: Run Twitch service test suite**

Run:
```bash
cd /home/dev/nighthub/server && npm run test -- src/services/twitch.service.test.ts
```
Expected: all Twitch service tests pass.

---

### Task 3: Keep Dashboard Composition Fast and Stable

**Files:**
- Modify: `server/src/services/aggregator.service.ts`
- Modify: `server/src/services/aggregator.service.test.ts`
- Test: `server/src/services/aggregator.service.test.ts`

- [ ] **Step 1: Add failing test asserting dashboard uses fast Twitch path**

Test `getDashboardData()` calls `twitchService.getLiveStreamsFast(20)` and not blocking network-heavy path for the dashboard composition call.

- [ ] **Step 2: Implement/confirm fast Twitch path usage**

In `getDashboardData()`:
- keep data loading parallelized with `Promise.allSettled`,
- use `getLiveStreamsFast(20)` for streams,
- preserve robust null-handling for weather and other sections.

- [ ] **Step 3: Keep cron Twitch check every 5 minutes**

Assert schedule `'*/5 * * * *'` remains present in cron initialization test.

- [ ] **Step 4: Run aggregator tests**

Run:
```bash
cd /home/dev/nighthub/server && npm run test -- src/services/aggregator.service.test.ts
```
Expected: all tests pass.

---

### Task 4: Add AI News Raw-Text Extraction Endpoint (TDD)

**Files:**
- Modify: `server/src/services/news.service.ts`
- Modify: `server/src/routes/api.routes.ts`
- Modify: `server/src/services/news.service.test.ts`
- Modify: `server/src/routes/api.routes.test.ts`

- [ ] **Step 1: Add failing tests in `news.service.test.ts`**

Add tests for:
- successful extraction returns plain text paragraphs,
- HTML noise nodes removed (`script/style/nav/aside/img`),
- timeout/paywall-like failure returns extraction error.

- [ ] **Step 2: Add failing route tests in `api.routes.test.ts`**

Add tests for new endpoint:
- success returns `{ title, source, content, url }`,
- failure returns dedicated error payload used by frontend fallback.

- [ ] **Step 3: Implement extraction in `news.service.ts`**

Add method such as `extractArticleText(url: string)`:
- fetch with timeout,
- parse html and remove non-content nodes,
- pick readable container and normalize to plain text blocks,
- return structured DTO.

- [ ] **Step 4: Wire route handler in `api.routes.ts`**

Expose endpoint:
- validate input URL,
- call extraction service,
- return success DTO,
- return extraction-failed response for frontend fallback.

- [ ] **Step 5: Run backend tests for news + routes**

Run:
```bash
cd /home/dev/nighthub/server && npm run test -- src/services/news.service.test.ts src/routes/api.routes.test.ts
```
Expected: all tests pass.

---

### Task 5: Implement News Text Popup + Fallback Behavior (Frontend)

**Files:**
- Create: `src/app/components/news-article-reader-popup/news-article-reader-popup.component.ts`
- Modify: `src/app/components/sections/news-section.component.ts`
- Modify: `src/app/services/api.service.ts`
- Modify/Create: `src/app/components/sections/news-section.component.spec.ts`

- [ ] **Step 1: Add failing frontend tests**

Add tests that assert:
- click article triggers API extraction call,
- success opens in-app popup with raw text,
- failure opens original URL in new tab.

- [ ] **Step 2: Add API method in `api.service.ts`**

Create typed method for article extraction endpoint.

- [ ] **Step 3: Create popup component**

Component displays:
- article title,
- source/domain,
- plain text body,
- close action.

- [ ] **Step 4: Integrate popup and fallback in `news-section.component.ts`**

On article click:
- call extraction API,
- on success show popup,
- on failure execute `window.open(url, '_blank', 'noopener,noreferrer')`.

- [ ] **Step 5: Run frontend targeted tests**

Run:
```bash
cd /home/dev/nighthub && npm test -- src/app/components/sections/news-section.component.spec.ts
```
Expected: tests pass for success and fallback flows.

---

### Task 6: Isolate Dashboard Refreshes and Preserve Side Panel Playback

**Files:**
- Modify: `src/app/pages/dashboard/dashboard.component.ts`
- Modify: `src/app/components/stream/stream-player-panel.component.ts`
- Modify: `src/app/pages/dashboard/dashboard.component.spec.ts`

- [ ] **Step 1: Add failing test for stream panel stability**

Add test:
- select stream `id=A`,
- simulate dashboard data refresh with updated metadata but same `id=A`,
- assert player component is not remounted/restarted.

- [ ] **Step 2: Introduce stable selection identity**

In dashboard component:
- track `selectedStreamId` as identity source,
- patch selected stream data non-destructively when same id exists after refresh,
- avoid global reset patterns that null and recreate selected stream.

- [ ] **Step 3: Section-level refresh isolation**

Replace broad reload where feasible with section-scoped updates so one action does not reset all stores/UI state.

- [ ] **Step 4: Side panel handling when stream disappears**

Keep panel open with last known state plus offline indicator (no forced close/remount).

- [ ] **Step 5: Run dashboard component tests**

Run:
```bash
cd /home/dev/nighthub && npm test -- src/app/pages/dashboard/dashboard.component.spec.ts
```
Expected: updated tests pass, including no-restart regression test.

---

### Task 7: SSE Reliability Guardrails

**Files:**
- Modify: `server/src/routes/api.routes.ts`
- Modify: `src/app/services/api.service.ts`
- Modify: `server/src/routes/api.routes.test.ts`

- [ ] **Step 1: Add/adjust failing tests for heartbeat behavior**

Assert SSE stream can emit heartbeat events while dashboard payload is pending.

- [ ] **Step 2: Implement/confirm backend heartbeat and no-buffer headers**

In stream route:
- emit heartbeat periodically,
- clear heartbeat timer in `finally`,
- keep anti-buffering header.

- [ ] **Step 3: Implement/confirm frontend heartbeat timeout reset**

In `getDashboardStream()`:
- reset watchdog on `progress` and `heartbeat`,
- ensure timeout/cleanup correctness.

- [ ] **Step 4: Run route tests**

Run:
```bash
cd /home/dev/nighthub/server && npm run test -- src/routes/api.routes.test.ts
```
Expected: all SSE route tests pass.

---

### Task 8: Write Functional Test Book (Cahier de Test) and Browser-Control Script

**Files:**
- Create: `docs/tests/2026-04-28-dashboard-functional-test-book.md`

- [ ] **Step 1: Draft preconditions and datasets**

Document explicit preconditions:
- followed Twitch channels with active/ended scenarios,
- extractible and blocked AI news URLs,
- expected cron window timing.

- [ ] **Step 2: Add step-by-step functional test cases**

Include FT-001 to FT-007 with:
- objective,
- step list,
- expected results,
- pass/fail criteria.

- [ ] **Step 3: Add browser-control execution script**

Include deterministic operator script for MCP browser-driven run with checkpoints/screenshots/log validation.

- [ ] **Step 4: Peer readability pass**

Verify instructions are executable by a teammate with no prior context.

---

### Task 9: Full Verification Before Completion

**Files:**
- Verify touched backend/frontend files above

- [ ] **Step 1: Run backend targeted suites**

Run:
```bash
cd /home/dev/nighthub/server && npm run test -- src/services/twitch.service.test.ts src/services/aggregator.service.test.ts src/services/news.service.test.ts src/routes/api.routes.test.ts
```
Expected: all pass.

- [ ] **Step 2: Run backend build**

Run:
```bash
cd /home/dev/nighthub/server && npm run build
```
Expected: `tsc` success.

- [ ] **Step 3: Run frontend targeted suites**

Run:
```bash
cd /home/dev/nighthub && npm test -- src/app/pages/dashboard/dashboard.component.spec.ts src/app/components/sections/news-section.component.spec.ts
```
Expected: targeted tests pass.

- [ ] **Step 4: Run functional browser test pass**

Execute `docs/tests/2026-04-28-dashboard-functional-test-book.md` manually with browser control.

- [ ] **Step 5: Record verification evidence**

Capture:
- command outputs summary,
- observed pass/fail per functional test id,
- known limitations (if any).

---

## Delivery Notes

1. Keep changes scoped to Twitch live correctness, dashboard isolation, and AI News reader.
2. Do not revert unrelated local modifications already present in workspace.
3. If a test failure is unrelated and pre-existing, document it explicitly with evidence.

