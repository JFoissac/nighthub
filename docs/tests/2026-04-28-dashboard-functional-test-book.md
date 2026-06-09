# Functional Test Book — Dashboard Twitch Isolation + News Reader

Date: 2026-04-28  
Owner: Task 8

## 1) Scope
Validate end-to-end behavior for:
- Twitch live/ended/stale isolation in dashboard rendering,
- AI news raw-text extraction endpoint safety and behavior,
- frontend fallback behavior when extraction fails.

This document is executable by a teammate with zero prior project context.

## 2) Test Environment
Use three terminals.

- Terminal A (backend):
```bash
cd /home/dev/nighthub/server
npm run dev | tee /tmp/nighthub-ft-server.log
```

- Terminal B (frontend):
```bash
cd /home/dev/nighthub
npm run start | tee /tmp/nighthub-ft-web.log
```

- Terminal C (operator + evidence):
```bash
cd /home/dev/nighthub
export FT_SERVER_LOG=/tmp/nighthub-ft-server.log
export FT_WEB_LOG=/tmp/nighthub-ft-web.log
```

Base URLs:
- UI: `http://localhost:4200`
- API: `http://localhost:3000/api`

## 3) Preconditions and Datasets

### 3.1 Twitch dataset (active + ended + stale)
Run once in Terminal C.

```bash
sqlite3 /home/dev/nighthub/server/dev.db <<'SQL'
DELETE FROM "TwitchStream" WHERE channelName IN ('FT Live Alpha','FT Ended Beta','FT Stale Gamma');

INSERT OR REPLACE INTO "TwitchStream" (
  id, twitchId, title, thumbnailUrl, viewerCount, channelName, channelAvatar, gameName, isLive, url, fetchedAt, createdAt
) VALUES
  ('ft-live-alpha', 'ft_live_alpha', 'FT Live Alpha Session', 'https://static-cdn.jtvnw.net/previews-ttv/live_user_ftlivealpha-320x180.jpg', 321, 'FT Live Alpha', 'https://static-cdn.jtvnw.net/jtv_user_pictures/x-profile_image-70x70.png', 'Just Chatting', 1, 'https://www.twitch.tv/ftlivealpha', datetime('now'), datetime('now')),
  ('ft-ended-beta', 'ft_ended_beta', 'FT Ended Beta Session', 'https://static-cdn.jtvnw.net/previews-ttv/live_user_ftendedbeta-320x180.jpg', 0, 'FT Ended Beta', 'https://static-cdn.jtvnw.net/jtv_user_pictures/x-profile_image-70x70.png', 'Science & Technology', 0, 'https://www.twitch.tv/ftendedbeta', datetime('now'), datetime('now')),
  ('ft-stale-gamma', 'ft_stale_gamma', 'FT Stale Gamma Session', 'https://static-cdn.jtvnw.net/previews-ttv/live_user_ftstalegamma-320x180.jpg', 111, 'FT Stale Gamma', 'https://static-cdn.jtvnw.net/jtv_user_pictures/x-profile_image-70x70.png', 'Science & Technology', 1, 'https://www.twitch.tv/ftstalegamma', datetime('now','-20 minutes'), datetime('now','-20 minutes'));
SQL
```

Then configure followed channels (required for fast Twitch path):

```bash
curl -sS -X POST http://localhost:3000/api/preferences \
  -H 'Content-Type: application/json' \
  -d '{"twitchFollows":"ftlivealpha,ftendedbeta,ftstalegamma"}'
```

### 3.2 AI news URL dataset (extractible + blocked + fallback)
Use these URLs throughout FT-005..FT-007:

- `EXTRACTIBLE_URL=https://en.wikipedia.org/wiki/OpenAI`
- `BLOCKED_URL=http://localhost:3000/private`
- `FALLBACK_URL=https://openai.com/robots.txt` (allowed host, non-article content, expected extraction failure)

### 3.3 Cron timing window
Twitch authoritative cron runs every 5 minutes (`*/5 * * * *`).

Before FT-003/FT-004, record current minute and next boundary:
```bash
date '+%Y-%m-%d %H:%M:%S %Z'
```
Expected cron window: next minute where minute value is divisible by 5 (e.g. `10:25`, `10:30`, `10:35`).

## 4) Functional Test Cases

### FT-001 — Environment boot + dashboard reachability
Objective: confirm app/API are up and dashboard is reachable.

Steps:
1. Open `http://localhost:4200` in browser.
2. Wait until top dashboard UI and at least one section title is visible.
3. Run:
```bash
curl -sS http://localhost:3000/api/dashboard | jq '.refreshedAt, (.streams|length), (.news|length)'
```

Expected:
- UI loads without blank/error screen.
- API returns valid JSON with `refreshedAt` and arrays.

Pass/Fail criteria:
- Pass: all 3 checks succeed.
- Fail: UI stuck/error, or API 5xx/invalid JSON.

---

### FT-002 — Twitch dataset precondition integrity
Objective: verify seeded active/ended/stale Twitch rows exist exactly as expected.

Steps:
1. Run:
```bash
sqlite3 /home/dev/nighthub/server/dev.db <<'SQL'
.headers on
.mode column
SELECT channelName, isLive, fetchedAt
FROM "TwitchStream"
WHERE channelName IN ('FT Live Alpha','FT Ended Beta','FT Stale Gamma')
ORDER BY channelName;
SQL
```
2. Confirm one row each for:
- `FT Live Alpha` with `isLive=1` and recent `fetchedAt`,
- `FT Ended Beta` with `isLive=0`,
- `FT Stale Gamma` with `isLive=1` and `fetchedAt` older than 15 minutes.

Expected:
- Dataset matches seeded values.

Pass/Fail criteria:
- Pass: all 3 rows present with correct live/stale attributes.
- Fail: missing row or wrong state.

---

### FT-003 — Dashboard Twitch isolation (active shown, ended/stale hidden)
Objective: confirm only fresh live stream appears in dashboard stream list.

Steps:
1. In browser, hard reload dashboard.
2. Locate stream section content.
3. Verify text presence/absence:
- `FT Live Alpha` must be visible.
- `FT Ended Beta` must not be visible.
- `FT Stale Gamma` must not be visible.
4. Validate API payload:
```bash
curl -sS http://localhost:3000/api/dashboard | jq '.streams[]?.channelName'
```

Expected:
- UI/API include only fresh live stream(s), not ended/stale seeded rows.

Pass/Fail criteria:
- Pass: visibility matches expected inclusion/exclusion.
- Fail: ended/stale streams appear in UI or API.

---

### FT-004 — Side panel stability across unrelated refresh action
Objective: verify stream player panel does not close/restart when refreshing non-stream content.

Steps:
1. Click `FT Live Alpha` to open side player panel.
2. Capture visible proof of open panel.
3. Trigger a non-stream action:
- click refresh from header, or
- use Add RSS flow and close modal without changes.
4. Wait for dashboard data refresh completion.
5. Verify player panel remains open on same stream identity (`FT Live Alpha`).

Expected:
- Panel stays mounted/open and still targets same stream.

Pass/Fail criteria:
- Pass: no close/reopen flicker and same stream remains selected.
- Fail: panel closes, remounts visibly, or stream identity changes unexpectedly.

---

### FT-005 — `/api/news/extract` success path (extractible URL)
Objective: verify extraction endpoint returns structured article payload for a readable URL.

Steps:
1. Run:
```bash
curl -sS -X POST http://localhost:3000/api/news/extract \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://en.wikipedia.org/wiki/OpenAI"}' | jq
```
2. Confirm returned fields: `title`, `source`, `content`, `url`.
3. Confirm `content` length is non-trivial (>120 chars).

Expected:
- HTTP 200 payload with normalized plain text content.

Pass/Fail criteria:
- Pass: field contract valid and content usable.
- Fail: 4xx/5xx or empty/unusable payload.

---

### FT-006 — `/api/news/extract` blocked URL safety path
Objective: verify SSRF protection rejects blocked internal targets.

Steps:
1. Run:
```bash
curl -i -sS -X POST http://localhost:3000/api/news/extract \
  -H 'Content-Type: application/json' \
  -d '{"url":"http://localhost:3000/private"}'
```
2. Confirm status `400` and response body contains:
```json
{"error":"URL_NOT_ALLOWED"}
```

Expected:
- blocked target is rejected without extraction attempt.

Pass/Fail criteria:
- Pass: exactly 400 + `URL_NOT_ALLOWED` contract.
- Fail: any 2xx/422/500 or missing safety error.

---

### FT-007 — Frontend fallback behavior when extraction fails
Objective: verify fallback opens original URL when extraction returns `ARTICLE_EXTRACTION_FAILED`.

Steps:
1. Seed one news row for deterministic click target:
```bash
sqlite3 /home/dev/nighthub/server/dev.db <<'SQL'
DELETE FROM "AiNewsItem" WHERE title = 'FT Fallback News';
INSERT INTO "AiNewsItem" (
  id, title, source, url, summary, pubDate, isNew, categories, author, fetchedAt, createdAt
) VALUES (
  'ft-news-fallback',
  'FT Fallback News',
  'openai',
  'https://openai.com/robots.txt',
  'Intentional non-article URL for fallback behavior test',
  datetime('now'),
  1,
  'test',
  'qa',
  datetime('now'),
  datetime('now')
);
SQL
```
2. Reload dashboard and click `FT Fallback News`.
3. Observe behavior:
- Expected path: extraction fails with 422 fallback payload and UI opens source URL in new tab.
4. Validate server logs:
```bash
grep -E "ARTICLE_EXTRACTION_FAILED|extractArticleText failed" "$FT_SERVER_LOG" | tail -n 20
```

Expected:
- No app crash.
- Original URL opens as fallback path.
- Server log contains extraction-failed trace.

Pass/Fail criteria:
- Pass: source URL fallback is triggered and user remains unblocked.
- Fail: click does nothing, UI errors, or no fallback open.

## 5) Deterministic MCP Browser Operator Script

Use this exact sequence with checkpoints.

### 5.1 Start browser session
1. `browser_set_session_name` with `"Task8 FT Dashboard"`
2. `browser_new_tab_group` with `name="Task8 FT"` and `url="http://localhost:4200"`
3. `browser_wait` with `text="NIGHTHUB"` timeout `20000`

Checkpoint CP-01:
- `browser_screenshot` (full page)
- Store returned file path in evidence table.

### 5.2 Verify Twitch isolation (FT-003)
1. `browser_get_dom` and confirm `FT Live Alpha` appears.
2. `browser_execute_js`:
```js
(() => ({
  hasLive: !!document.body.innerText.includes('FT Live Alpha'),
  hasEnded: !!document.body.innerText.includes('FT Ended Beta'),
  hasStale: !!document.body.innerText.includes('FT Stale Gamma')
}))()
```

Checkpoint CP-02:
- `browser_screenshot` with stream section visible.
- Expected JS result: `hasLive=true`, `hasEnded=false`, `hasStale=false`.

### 5.3 Verify panel stability (FT-004)
1. `browser_click` text `FT Live Alpha`
2. `browser_wait` `ms=1000`
3. `browser_screenshot` (CP-03, panel open)
4. Trigger refresh (click refresh UI control by text/selector).
5. `browser_wait` `ms=3000`
6. `browser_execute_js` to assert panel still references same stream text.

Checkpoint CP-04:
- screenshot after refresh; compare CP-03 vs CP-04 (panel still open).

### 5.4 Verify fallback flow (FT-007)
1. `browser_click` text `FT Fallback News`
2. `browser_wait` `ms=2500`
3. `browser_list_tabs`

Checkpoint CP-05:
- Expected: new tab opened to `https://openai.com/robots.txt` (or same URL in current tab, depending on app behavior).
- Capture screenshot of destination tab.

### 5.5 Log validation checkpoints
After CP-02/CP-04/CP-05, run in Terminal C:
```bash
grep -E "\[Cron\] Checking Twitch streams|\[Aggregator\] Twitch check|ARTICLE_EXTRACTION_FAILED|extractArticleText failed" "$FT_SERVER_LOG" | tail -n 50
```

Checkpoint CP-06:
- Confirm relevant log lines exist for actions performed.

## 6) Evidence Template (fill during run)

| Checkpoint | Artifact | Result | Notes |
|---|---|---|---|
| CP-01 | screenshot path | Pass/Fail | Dashboard loaded |
| CP-02 | screenshot + JS output | Pass/Fail | Twitch isolation visible |
| CP-03 | screenshot path | Pass/Fail | Panel opened |
| CP-04 | screenshot + JS output | Pass/Fail | Panel stable after refresh |
| CP-05 | screenshot + tab URL | Pass/Fail | Fallback navigation |
| CP-06 | log snippet | Pass/Fail | Backend traces present |

## 7) Final Exit Criteria
Run is accepted only if:
- FT-001..FT-007 are all Pass,
- all checkpoints CP-01..CP-06 have captured evidence,
- any deviation is recorded with exact timestamp and reproduction note.
