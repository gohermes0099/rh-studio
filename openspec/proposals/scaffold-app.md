# Proposal: Scaffold App — RH Studio Foundation

## Intent

First scaffold to establish the monorepo structure and build a fully functional local desktop app for discovering, configuring, and executing RunningHub AI Apps. Every future feature builds on this foundation.

## Scope

### In Scope

- Monorepo scaffold: `client/`, `server/`, `shared/` with unified dev scripts
- Express API server proxying all RH API calls (frontend never talks to RH directly)
- React SPA with 6 routes: Catalog, Register, Runner, History, TaskDetail, Settings
- SQLite schema (WAL mode): `tools` (metadata + schema), `tasks` (execution + status + results), `settings` (key-value config)
- Dynamic form generation from RH `nodeInfoList` — one generic component per `fieldType` (IMAGE, STRING, LIST, SWITCH, LORA, INT, FILE, AUDIO, VIDEO)
- RH integration: register by webappId, fetch schema, run, poll every 5s, upload files, download results
- API key management: set, validate, `keyIsSet` boolean to frontend

### Out of Scope

- User authentication and multi-user support
- Production deployment (domain, SSL, containerization)
- Rate limiting, caching, or job queue
- RH webhook / callback integration
- Comprehensive test suite (strict TDD deferred)

## Approach

Backend-first monorepo. Server owns all RH API communication — frontend only hits local Express routes. Dynamic forms render from fetched schemas via a single `DynamicField.tsx` component switched on `fieldType`. Poll-based result retrieval (5s interval) with local file download. File upload flows frontend → server proxy → RH; returned `fileName` stored as field value. Download endpoint fetches results from RH and streams to client. Task state machine: PENDING → RUNNING → COMPLETED | FAILED | EXPIRED.

## Key Decisions

- **Backend proxy**: API key never leaves server. Frontend only sees `keyIsSet: boolean`. Zero RH credentials in client bundle.
- **Dynamic forms**: One generic component reads `nodeInfoList`, renders inputs by fieldType. No per-tool hardcoded forms — adding a new RH app requires zero frontend changes.
- **Polling over SSE**: Simpler implementation, no persistent connections, sufficient for 5s intervals. SSE can be adopted later if needed.
- **better-sqlite3 + WAL**: Synchronous API fits single-user desktop use perfectly. No async pool overhead. WAL mode for concurrent reads during polling.
- **File flow**: Multipart frontend → server → RH via `multer`. Response `fileName` set as field value. Download via server endpoint that streams RH response directly.
- **Type sharing**: Shared interfaces in `shared/` consumed by both client and server via tsconfig path aliases.

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| RH API breaking changes | Low | Pin schema fetch format; flag UI on parse mismatch |
| Large file upload timeouts | Med | 60s server proxy timeout; warn frontend on files >50MB |
| Polling state drift after 24h | Low | Mark tasks EXPIRED when last poll exceeds 25h; surface in UI |
| better-sqlite3 native build fails | Low | Document `sql.js` fallback path (slower, no native deps) |

## Dependencies

- **Client**: `react`, `react-dom`, `react-router-dom`, `vite`, `@vitejs/plugin-react`, `typescript`
- **Server**: `express`, `better-sqlite3`, `tsx`, `multer`, `typescript`, `@types/express`, `@types/better-sqlite3`, `@types/multer`
- **Root**: `concurrently` for parallel dev script (`npm run dev` starts both)
- **Shared**: tsconfig paths for cross-directory imports

## Estimated Effort

| Phase | Hours | Description |
|-------|-------|-------------|
| Monorepo scaffold | 2 | Directory structure, package.json, tsconfig, dev scripts |
| DB layer | 3 | Schema, migrations, CRUD helpers for tools/tasks/settings |
| RH API client | 3 | HTTP client, schema fetch, run, poll, upload, download |
| Backend routes | 4 | Express routes: tools, tasks, settings, file proxy, polling |
| Frontend shell | 2 | Vite setup, router, layout, shared components |
| Dynamic forms | 4 | `DynamicField.tsx` per fieldType, form builder, validation |
| Runner + History | 3 | Execute UI, task list, detail view, result display |
| Settings page | 1 | API key form, validation status |
| Integration wiring | 2 | Connect frontend to backend, test full flows |
| **Total** | **24** | Rough estimate for a single developer |

## Success Criteria

- [ ] `npm run dev` starts both Vite client and Express server
- [ ] Register an RH AI App by webappId → schema fetched and persisted
- [ ] Dynamic form renders all field types correctly
- [ ] Execute a tool → task created → polled → completed with result
- [ ] Upload files through proxy, download result files
- [ ] API key management: set, validate, frontend shows correct `keyIsSet`
- [ ] Task history survives server restart (SQLite persistence)
