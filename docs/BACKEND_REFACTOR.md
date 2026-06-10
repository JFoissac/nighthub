# Backend Refactor

## Summary

The backend is now organized around small route modules assembled by a central router factory.
Cron scheduling has been moved out of `AggregatorService` into a dedicated initializer so tests can exercise the service without enabling timers.

## Route Structure

- `server/src/routes/createApiRouter.ts` is the explicit assembly point for the API surface.
- Domain modules stay split by concern:
  - `dashboard.routes.ts`
  - `youtube.routes.ts`
  - `twitch.routes.ts`
  - `news.routes.ts`
  - `preferences.routes.ts`
  - `market.routes.ts`
- Shared validation helpers live in `server/src/routes/route.utils.ts`.

Notes:
- Existing response bodies and status codes are preserved.
- Validation remains permissive where the previous behavior relied on clamping or fallback defaults.

## Cron Strategy

- `server/src/jobs/aggregator.cron.ts` owns cron registration.
- `AggregatorService` now delegates cron setup to this factory and only keeps shutdown state.
- The cron initializer receives dependencies explicitly, which makes it easy to inject mocks in tests.

## Injection / Testing

- Route assembly is imported through a factory/central module rather than duplicating wiring in `app.ts`.
- Cron jobs can be instantiated with mocked services and a mocked scheduler.
- Tests cover:
  - route resolution through the assembled router
  - cron scheduling expressions and callback wiring
  - aggregator lifecycle start/stop delegation

## Security Assumptions

- No new unauthenticated endpoints were added.
- Existing input validation remains in place for critical parameters:
  - pagination limits
  - weather city
  - RSS URLs
  - YouTube handles and channel IDs
- The refactor changes structure, not the API contract.
