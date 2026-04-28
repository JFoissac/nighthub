# Design: Dashboard Twitch Live Correctness, UI Isolation, and AI News Text Reader

**Date**: 2026-04-28  
**Status**: Draft for review

---

## Context

Three regressions/needs are now grouped into one focused dashboard stabilization effort:

1. Twitch live section can show ended lives (stale live state).
2. Watching a live in side panel is interrupted by unrelated dashboard actions (player restarts).
3. AI News article click must open a clean popup with raw text body (no ads/images), with fallback to original tab on extraction failure.

This design preserves fast dashboard loading (cache-first) while restoring correctness and interaction isolation.

---

## Goals

1. Keep dashboard startup fast with cache-first behavior.
2. Ensure Twitch ended lives disappear no later than the next cron tick.
3. Prevent cross-section refresh side effects (one section refresh must not reset the whole dashboard).
4. Keep side-panel live playback stable when selected stream identity is unchanged.
5. Add AI News raw-text article reader popup with fallback to original URL when extraction fails.
6. Deliver a functional test plan + executable step-by-step test book for browser-controlled validation.

---

## Non-Goals

1. Full real-time websocket architecture migration.
2. Reworking non-Twitch ranking/relevance logic.
3. Full-page article rendering (styles/media); target is text-only reading.

---

## Product Rules (Validated)

1. Ended Twitch live must disappear at next cron refresh.
2. Dashboard remains cache-first between cron ticks (fast first paint preferred).
3. Side panel live player must never restart if the selected stream `id` stays the same.
4. AI News click opens text-only popup; if extraction fails, fallback opens original article in a new tab.

---

## Architecture

### A) Twitch Live Correctness with Background Verification

#### Behavior

1. `getLiveStreamsFast()` returns cached live streams immediately.
2. Background lightweight refresh runs when stale.
3. Cron `*/5 * * * *` remains authoritative for live truth.
4. At each authoritative refresh:
   - currently live channels are upserted and `fetchedAt` refreshed,
   - cached live channels missing from current live set are set `isLive = false`.
5. Cached live reads include freshness window (`fetchedAt >= now - LIVE_CACHE_MAX_AGE_MS`) to avoid stale display.

#### Files

1. `server/src/services/twitch.service.ts`
2. `server/src/services/aggregator.service.ts`

---

### B) Dashboard Refresh Isolation + Stable Side Panel Playback

#### Problem

Current global reload patterns can remount components and restart side-panel stream playback when unrelated sections refresh.

#### Target Behavior

1. Introduce identity-stable selection in dashboard:
   - `selectedStreamId` as source of truth.
   - preserve selected stream binding across section refreshes if same id exists.
2. Section-level refreshes update only relevant stores.
3. Side panel player component lifecycle remains stable for same selected id.
4. Only explicit close action or selected id change remounts/reloads playback target.

#### File focus

1. `src/app/pages/dashboard/dashboard.component.ts`
2. `src/app/components/stream/stream-player-panel.component.ts`
3. Any store/update path causing global remount side effects.

---

### C) AI News Raw-Text Reader Popup

#### Behavior

1. Clicking a news item requests backend extraction for raw readable text.
2. Popup shows:
   - title,
   - source/domain,
   - plain text body (paragraph-preserving, no media/ads/widgets).
3. Extraction failure conditions (timeout/paywall/block/invalid parser output) trigger fallback:
   - close loading state,
   - open article URL in new tab.

#### Backend responsibilities

1. Fetch article HTML with timeout.
2. Extract main readable text via deterministic rules:
   - remove scripts/styles/nav/footer/aside/media/ads.
   - prioritize semantic containers (`article`, `main`) then longest text block fallback.
3. Sanitize output to plain text paragraphs.
4. Return error code used by frontend fallback decision.

#### File focus

1. `server/src/services/news.service.ts`
2. `server/src/routes/api.routes.ts`
3. `src/app/services/api.service.ts`
4. `src/app/components/sections/news-section.component.ts`
5. New popup component for text reader (standalone).

---

## Error Handling

1. Twitch refresh failure:
   - keep previous cached fresh live entries only,
   - never synthesize unknown live state from failed fetch.
2. Stream player stability:
   - if selected live disappears from refreshed list, keep current panel state and surface offline status badge (no forced close).
3. News extraction failure:
   - deterministic fallback to `window.open(originalUrl, '_blank', 'noopener,noreferrer')`.
4. SSE robustness:
   - keep heartbeat-based anti-timeout path.

---

## Data Flow

### Twitch

1. Dashboard load -> `getDashboardData()`
2. Twitch branch -> `getLiveStreamsFast()` (instant cache read)
3. In background -> `refreshLiveCacheLight()` if stale
4. Cron tick authoritative refresh updates live/ended status
5. Next read only exposes fresh `isLive=true` rows

### Side Panel

1. User selects stream -> store `selectedStreamId`
2. Section/global data refresh occurs
3. If refreshed data still contains `selectedStreamId`, update metadata only, no player remount
4. If missing, keep current playback object and mark state offline

### AI News Reader

1. User clicks article
2. Frontend calls extraction endpoint
3. If success -> render plain text popup
4. If failure -> open source URL in new tab

---

## Verification Strategy

### Automated Tests

1. Twitch service tests:
   - ended lives become `isLive=false` at refresh,
   - unchanged live set still refreshes timestamps,
   - stale cached rows are not returned.
2. Aggregator tests:
   - dashboard Twitch branch uses fast cache path,
   - cron Twitch schedule unchanged at 5 min.
3. API route tests:
   - news extraction endpoint success/failure behavior.
4. Frontend component tests:
   - side panel does not remount for unchanged selected id,
   - section refresh does not reset unrelated sections.

### Manual Functional Tests (Cahier de test)

#### Test Environment Preconditions

1. Backend and frontend running locally.
2. At least two followed Twitch channels (one active live, one offline).
3. At least two AI News articles:
   - one publicly extractible,
   - one blocked/paywall-like source.
4. Browser devtools available for console/network checks.

---

## Functional Test Book (Step-by-Step, Browser-Control Ready)

### FT-001 Twitch fast load (cache-first)

1. Open dashboard home.
2. Measure time until Twitch section content appears.
3. Confirm no blocking spinner beyond normal global load.
4. Expected:
   - Twitch entries render quickly from cache.
   - No visible dependency on full Twitch network response.

### FT-002 Ended live removed at next cron tick

1. Keep dashboard open with a currently live channel visible.
2. Stop the live stream (or use a test channel that ends).
3. Wait for next cron boundary (`*/5`).
4. Trigger dashboard refresh action once after cron tick.
5. Expected:
   - ended stream no longer listed in Twitch live section.
   - logs indicate ended live cleanup.

### FT-003 Side panel no restart on unrelated actions

1. Open a Twitch live in side panel.
2. Perform unrelated actions:
   - open settings modal and close,
   - trigger news section refresh,
   - trigger weather/open-close interactions.
3. Expected:
   - stream playback continues uninterrupted,
   - no player remount/restart,
   - selected stream id unchanged.

### FT-004 Section refresh isolation

1. Note current counts/content for streams/videos/news.
2. Trigger refresh action scoped to one section (news or twitch as implemented).
3. Expected:
   - only target section updates,
   - other sections maintain state and selection context.

### FT-005 AI News raw-text popup success path

1. Click an extractible AI News article.
2. Expected popup content:
   - title visible,
   - source visible,
   - plain text body only.
3. Confirm no inline ads/images/embed blocks.

### FT-006 AI News fallback path

1. Click known blocked/paywall article.
2. Expected:
   - raw-text popup not shown (or shows brief extraction failure state),
   - original article opens in new tab automatically.

### FT-007 SSE/session robustness with active side panel

1. Open side panel live.
2. Wait through at least one dashboard refresh cycle.
3. Watch console for SSE timeout/error.
4. Expected:
   - no player restart,
   - no forced panel close,
   - no recurring SSE timeout spam.

---

## Browser-Control Execution Script (Operator Sequence)

1. Navigate to dashboard URL.
2. Validate Twitch visible rows and capture screenshot A.
3. Open first Twitch live in side panel and confirm playback start.
4. Execute action set:
   - open settings,
   - close settings,
   - refresh news section,
   - return focus to side panel.
5. Assert playback continuity and capture screenshot B.
6. Click AI News article #1 -> assert text popup -> capture screenshot C.
7. Close popup.
8. Click AI News article #2 (known failure source) -> assert new tab fallback.
9. Wait cron boundary and refresh dashboard once.
10. Validate ended lives removed.

---

## Acceptance Criteria

1. No ended Twitch live remains visible after next cron tick.
2. Dashboard keeps cache-first Twitch startup performance.
3. Side panel playback is stable for identical selected stream id.
4. AI News click opens clean raw-text popup on success.
5. AI News extraction failure always opens source in new tab.
6. Functional test book can be executed end-to-end with deterministic pass/fail checks.

