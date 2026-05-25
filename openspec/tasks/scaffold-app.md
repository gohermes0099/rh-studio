# SDD Tasks: Scaffold App — RH Studio Foundation

| Field | Value |
|-------|-------|
| **Change ID** | scaffold-app |
| **Status** | Tasked |
| **Spec** | `openspec/specs/scaffold-app.md` |
| **Design** | `openspec/designs/scaffold-app.md` |

---

## Task Inventory

| Task | Name | Effort | Dependencies |
|------|------|--------|-------------|
| T-1 | Monorepo Scaffold | 0.5h | None |
| T-2 | SQLite Database Layer | 1h | T-1 |
| T-3 | Shared Types | 0.5h | T-1 |
| T-4 | RH API Client | 1.5h | T-2, T-3 |
| T-5 | Settings Routes | 1h | T-4 |
| T-6 | Tools Routes | 1h | T-4 |
| T-7 | Tasks Routes (Polling + Execution) | 2h | T-4 |
| T-8 | Upload & Download Routes | 1.5h | T-4 |
| T-9 | Server Entry Point | 1h | T-5, T-6, T-7, T-8 |
| T-10 | Vite + React Setup | 0.5h | T-1 |
| T-11 | Layout & Navigation | 1h | T-10 |
| T-12 | API Client Layer | 0.5h | T-3 |
| T-13 | Custom Hooks | 1.5h | T-12 |
| T-14 | Settings Page | 1h | T-11, T-13 |
| T-15 | Register Tool Page | 1h | T-11, T-13 |
| T-16 | Catalog Page | 1.5h | T-11, T-13, T-21 |
| T-17 | DynamicField Components | 2h | T-10, T-3 |
| T-18 | Tool Runner Page | 1.5h | T-11, T-13, T-17 |
| T-19 | Task History Page | 1h | T-11, T-13, T-21 |
| T-20 | Task Detail Page | 2h | T-11, T-13, T-21 |
| T-21 | Shared Components | 1h | T-10 |
| T-22 | Wire Up End-to-End | 1h | T-14–T-21 |
| T-23 | Error Handling & Edge Cases | 1h | T-22 |

**Total estimated effort**: 25.5 hours

---

## Phase 1: Foundation

### Task T-1: Monorepo Scaffold
**Files**: `package.json`, `tsconfig.base.json`, `.gitignore`
**Dependencies**: None
**Effort**: 0.5 hours
**Acceptance Criteria**:
- [ ] Root `package.json` declares `concurrently` as devDependency with `dev`, `build`, `start` scripts
- [ ] `tsconfig.base.json` has strict mode enabled, path aliases for `@shared/*`, `@server/*`, `@client/*`
- [ ] `.gitignore` excludes `node_modules/`, `data/`, `dist/`, `uploads/`, `downloads/`
- [ ] Running `npm install` at root succeeds

---

### Task T-2: SQLite Database Layer
**Files**: `server/src/db/connection.ts`, `server/src/db/migrations.ts`
**Dependencies**: T-1
**Effort**: 1 hour
**Acceptance Criteria**:
- [ ] `connection.ts` opens `data/rh-studio.db` via better-sqlite3 with `PRAGMA journal_mode=WAL` and `PRAGMA foreign_keys=ON`
- [ ] `connection.ts` ensures `data/` directory exists before opening DB
- [ ] `migrations.ts` exports `runMigrations(db)` that creates all three tables (`tools`, `tasks`, `settings`) with exact columns and constraints from spec §3
- [ ] All indexes from spec are created (`idx_tools_webappId`, `idx_tools_updatedAt`, `idx_tasks_taskId`, `idx_tasks_toolId`, `idx_tasks_status`, `idx_tasks_createdAt`)
- [ ] `ON DELETE CASCADE` is set on `tasks.toolId` foreign key
- [ ] Running migrations twice is idempotent (no errors on re-run)

---

### Task T-3: Shared Types
**Files**: `shared/types.ts`
**Dependencies**: T-1
**Effort**: 0.5 hours
**Acceptance Criteria**:
- [ ] `FieldType` union type defined: `'IMAGE' | 'AUDIO' | 'VIDEO' | 'FILE' | 'STRING' | 'LIST' | 'SWITCH' | 'LORA' | 'INT'`
- [ ] `TaskStatus` union type defined: `'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'EXPIRED'`
- [ ] `FieldData` interface: `description?`, `required?`, `multiline?`, `min?`, `max?`
- [ ] `RhNodeInfo` interface: `nodeId`, `nodeName`, `nodeType`, `fieldName`, `fieldType`, `fieldValue`, `fieldData`
- [ ] `Tool` interface: `id`, `webappId`, `webappName`, `nodeInfoList`, `tags`, `createdAt`, `updatedAt`, `taskCount?`
- [ ] `Task` interface: `id`, `taskId`, `toolId`, `toolName?`, `status`, `nodeInfoList`, `resultFiles`, `errorMessage?`, `failedReason?`, `pollCount`, `lastPolledAt?`, `createdAt`, `updatedAt`, `completedAt?`, `resultCount?`
- [ ] `ResultFile` interface: `nodeId`, `filePath`, `fileName`, `mimeType`
- [ ] All date fields typed as `string` (ISO 8601)

---

## Phase 2: Backend API

### Task T-4: RH API Client
**Files**: `server/src/services/rhClient.ts`
**Dependencies**: T-2, T-3
**Effort**: 1.5 hours
**Acceptance Criteria**:
- [ ] `RhClient` class constructed with `apiKey: string`
- [ ] `baseUrl` set to `https://api.runninghub.ai`, timeout 120s per NFR-04
- [ ] `fetchSchema(webappId)` calls `GET /api/webapp/apiCallDemo?webappId={id}`, returns parsed response with `nodeInfoList`
- [ ] `runTask(webappId, nodeInfoList)` calls `POST /openapi/v2/run/ai-app/{webappId}`, returns `{ taskId }`
- [ ] `queryTask(taskId)` calls `POST /openapi/v2/query` with `{ taskId }`, returns status, resultUrls, error info
- [ ] `uploadFile(file, originalName)` calls `POST /openapi/v2/upload` as multipart, returns `{ fileName }`
- [ ] `downloadResult(url)` fetches URL, returns file `Buffer`
- [ ] `validateKey()` makes a test fetchSchema call, returns `true` on success, `false` on failure
- [ ] All methods throw typed errors with RH error code, message, and HTTP status
- [ ] All HTTP calls use a shared agent/instance with the configured timeout

---

### Task T-5: Settings Routes
**Files**: `server/src/routes/settings.ts`
**Dependencies**: T-4
**Effort**: 1 hour
**Acceptance Criteria**:
- [ ] `GET /api/settings/key/status` returns `{ keyIsSet: boolean }` by querying `settings` table for `rh_api_key`
- [ ] `POST /api/settings/key` accepts `{ apiKey: string }`, upserts into `settings` table
- [ ] On `POST /api/settings/key`, immediately calls `rhClient.validateKey()` with the new key
- [ ] If `validateKey()` returns `true`, returns `200 { keyIsSet: true }`
- [ ] If `validateKey()` returns `false`, deletes the key from settings (rollback), returns `400 { error: "Invalid API key", keyIsSet: false }`
- [ ] Never exposes the API key value in any response

---

### Task T-6: Tools Routes
**Files**: `server/src/routes/tools.ts`
**Dependencies**: T-4
**Effort**: 1 hour
**Acceptance Criteria**:
- [ ] `POST /api/tools/register` accepts `{ webappId: string }`, validates UUID format and non-empty
- [ ] Calls `rhClient.fetchSchema(webappId)` to get schema from RH
- [ ] If RH response lacks `nodeInfoList`, returns `400 { error: "Invalid webappId or schema fetch failed" }`
- [ ] Parses schema, extracts `webappName`, `nodeInfoList`, `tags` from RH response
- [ ] Upserts into `tools` table (INSERT OR REPLACE / UPDATE if exists), bumps `updatedAt`
- [ ] Returns `201 { tool: { id, webappId, webappName, nodeInfoList, tags, createdAt, updatedAt } }`
- [ ] `GET /api/tools` returns `{ tools: Tool[] }` sorted by `updatedAt DESC`, includes `taskCount` (COUNT from tasks table)
- [ ] `DELETE /api/tools/:id` removes tool with cascade to tasks, returns `200 { success: true }`
- [ ] Returns `404 { error: "Tool not found" }` if `:id` doesn't exist

---

### Task T-7: Tasks Routes (Polling + Execution)
**Files**: `server/src/routes/tasks.ts`
**Dependencies**: T-4
**Effort**: 2 hours
**Acceptance Criteria**:
- [ ] `POST /api/tasks/run` accepts `{ toolId, fieldValues }`, resolves tool from DB
- [ ] For file-type fields where value was already uploaded (fileName from RH), uses as-is in payload
- [ ] Constructs `nodeInfoList` payload with updated `fieldValue` entries for each field
- [ ] Calls `rhClient.runTask(webappId, nodeInfoList)`, extracts `taskId` from response
- [ ] Creates task record with `status: PENDING`, returns `201 { task: { id, taskId, toolId, status, createdAt } }`
- [ ] `GET /api/tasks` returns `{ tasks: Task[] }` sorted by `createdAt DESC`, includes `toolName` via JOIN
- [ ] Supports query params `?search=term` (LIKE on tool name) and `?status=COMPLETED` (exact match)
- [ ] `GET /api/tasks/:id` returns full task detail including `nodeInfoList`, `resultFiles`, error info
- [ ] On each `GET /api/tasks/:id` call: if task is `PENDING` or `RUNNING`, calls `rhClient.queryTask(taskId)` to poll RH
- [ ] Maps RH status codes: `processing`→`RUNNING`, `succeed`→`COMPLETED`, `failed`→`FAILED`
- [ ] On `COMPLETED`: downloads all result files via `rhClient.downloadResult()`, saves to `downloads/{taskId}/`, updates `resultFiles`
- [ ] On `FAILED`: captures `errorMessage` and `failedReason`, updates task record
- [ ] 25-hour expiry check on every poll: if `createdAt + 25h < now`, sets `EXPIRED`
- [ ] Increments `pollCount` and updates `lastPolledAt` on each poll
- [ ] `DELETE /api/tasks/:id` removes task, returns `200 { success: true }`
- [ ] `404` returned for missing task on GET/DELETE by id

---

### Task T-8: Upload & Download Routes
**Files**: `server/src/routes/upload.ts`
**Dependencies**: T-4
**Effort**: 1.5 hours
**Acceptance Criteria**:
- [ ] `POST /api/upload` accepts `multipart/form-data` with field `file` via multer
- [ ] Validates MIME type against expected content types per spec FR-08
- [ ] Calls `rhClient.uploadFile(req.file.buffer, req.file.originalname)`, returns `{ fileName }`
- [ ] Saves uploaded file buffer temporarily to `uploads/` directory (configurable path)
- [ ] 50MB file size limit enforced by multer (returns `413` on exceed)
- [ ] `GET /api/download/:taskId/:nodeId` looks up task from DB, finds matching resultFile by nodeId
- [ ] Streams file with correct `Content-Type` and `Content-Disposition: attachment`
- [ ] Path traversal protection: validates taskId and nodeId don't contain `../`
- [ ] Returns `404 { error: "File not found" }` if file doesn't exist on disk

---

### Task T-9: Server Entry Point
**Files**: `server/src/index.ts`, `server/package.json`, `server/tsconfig.json`
**Dependencies**: T-5, T-6, T-7, T-8
**Effort**: 1 hour
**Acceptance Criteria**:
- [ ] `server/package.json` declares all server dependencies (express, better-sqlite3, multer, cors, tsx, types)
- [ ] `server/tsconfig.json` extends `../tsconfig.base.json`, has `outDir: ./dist`, `module: ESNext`, `moduleResolution: bundler`
- [ ] `index.ts` runs migrations on startup before starting express
- [ ] Middleware stack in correct order: `cors()`, `express.json()`, `express.urlencoded()`, `apiKeyGuard`, routes, `errorHandler`
- [ ] `apiKeyGuard` middleware skips `/api/settings/key` and `/api/settings/key/status`, checks `rh_api_key` in settings for all other `/api/*` routes
- [ ] All route modules mounted at correct paths
- [ ] Centralized `errorHandler` handles multer errors, JSON parse errors, and generic errors with proper status codes
- [ ] Listens on port `3001` (NFR-01)
- [ ] Console logs `Server running on http://localhost:3001` on start

---

## Phase 3: Frontend Shell

### Task T-10: Vite + React Setup
**Files**: `client/package.json`, `client/vite.config.ts`, `client/tsconfig.json`, `client/index.html`, `client/src/main.tsx`, `client/src/App.tsx`, `client/src/types/index.ts`
**Dependencies**: T-1
**Effort**: 0.5 hours
**Acceptance Criteria**:
- [ ] `client/package.json` declares all client dependencies (react, react-dom, react-router-dom, vite, @vitejs/plugin-react)
- [ ] `vite.config.ts` has React plugin, dev server on port `5173`, proxy `/api` to `http://localhost:3001`
- [ ] `tsconfig.json` extends base, `jsx: react-jsx`
- [ ] `index.html` has `<div id="root">` and `<script type="module" src="/src/main.tsx">`
- [ ] `main.tsx` renders `<App />` via `ReactDOM.createRoot`
- [ ] `App.tsx` sets up `BrowserRouter` with `<Routes>` and layout wrapper
- [ ] `client/src/types/index.ts` re-exports from `@shared/types`
- [ ] `npm run dev` in client starts and shows placeholder page

---

### Task T-11: Layout & Navigation
**Files**: `client/src/components/Layout.tsx`
**Dependencies**: T-10
**Effort**: 1 hour
**Acceptance Criteria**:
- [ ] `Layout.tsx` renders a top nav bar with links: Catalog (`/`), Register (`/register`), History (`/history`), Settings (`/settings`)
- [ ] Active route is highlighted using `NavLink` active class
- [ ] KeyIsSet indicator (green dot when configured, red dot when not) in nav bar — calls `GET /api/settings/key/status` on mount
- [ ] `<Outlet />` renders child pages below nav bar
- [ ] Responsive down to 1024px width (NFR-09)
- [ ] CSS/styling is simple and clean (Tailwind optional, plain CSS or CSS modules acceptable)

---

### Task T-12: API Client Layer
**Files**: `client/src/api/index.ts`
**Dependencies**: T-3
**Effort**: 0.5 hours
**Acceptance Criteria**:
- [ ] `apiGet<T>(path)` wraps `fetch` with GET method, returns parsed JSON as `T`
- [ ] `apiPost<T>(path, body)` wraps `fetch` with POST, JSON body, returns `T`
- [ ] `apiDelete<T>(path)` wraps `fetch` with DELETE, returns `T`
- [ ] `apiUpload<T>(path, formData)` wraps `fetch` with POST and `FormData` body (no Content-Type header — let browser set multipart boundary)
- [ ] All functions throw on non-ok response with the parsed error body
- [ ] Base path is always `/api` (Vite proxy handles the rest)

---

### Task T-13: Custom Hooks
**Files**: `client/src/hooks/useTools.ts`, `client/src/hooks/useTasks.ts`, `client/src/hooks/useSettings.ts`, `client/src/hooks/usePolling.ts`
**Dependencies**: T-12
**Effort**: 1.5 hours
**Acceptance Criteria**:
- [ ] `useTools()` manages `{ tools: Tool[], loading, error }`, exposes `fetchTools()`, `registerTool(webappId)`, `deleteTool(id)`
- [ ] `registerTool` calls `POST /api/tools/register`, `deleteTool` calls `DELETE /api/tools/:id`, `fetchTools` calls `GET /api/tools`
- [ ] `useTasks()` manages `{ tasks: Task[], loading, error }`, exposes `fetchTasks(params?)`, `fetchTask(id)`, `runTask(toolId, fieldValues)`, `deleteTask(id)`
- [ ] `runTask` calls `POST /api/tasks/run`, `fetchTask` calls `GET /api/tasks/:id`, `fetchTasks` calls `GET /api/tasks`
- [ ] `useSettings()` manages `{ keyIsSet: boolean, loading, error }`, exposes `checkKeyStatus()`, `setApiKey(apiKey)`
- [ ] `checkKeyStatus` calls `GET /api/settings/key/status`, `setApiKey` calls `POST /api/settings/key`
- [ ] `usePolling(taskId)` polls `GET /api/tasks/:id` every 5000ms, returns `{ task, loading, error }`
- [ ] `usePolling` calls immediately on mount, then every 5s via `setInterval`
- [ ] `usePolling` stops polling when `task.status` is terminal (`COMPLETED | FAILED | EXPIRED`)
- [ ] `usePolling` cleans up interval on unmount via `useEffect` return
- [ ] `usePolling` does nothing if `taskId` is `null`

---

## Phase 4: Frontend Pages

### Task T-14: Settings Page
**Files**: `client/src/pages/Settings.tsx`
**Dependencies**: T-11, T-13
**Effort**: 1 hour
**Acceptance Criteria**:
- [ ] Shows current `keyIsSet` status on mount via `useSettings().checkKeyStatus()`
- [ ] Displays "API Key: Configured ✓" or "API Key: Not Set" indicator
- [ ] Password input (`type="password"`) for the API key
- [ ] Submit calls `useSettings().setApiKey(apiKey)`
- [ ] On success, updates `keyIsSet` status immediately
- [ ] On failure, shows inline error message (e.g., "Invalid API key")
- [ ] Optional path config for `uploads_path` and `downloads_path` (stretch — hardcoded defaults acceptable for now)

---

### Task T-15: Register Tool Page
**Files**: `client/src/pages/RegisterTool.tsx`
**Dependencies**: T-11, T-13
**Effort**: 1 hour
**Acceptance Criteria**:
- [ ] Single input for `webappId` with UUID format validation (`/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`)
- [ ] Submit button (disabled while input is invalid or request in flight)
- [ ] Loading state during registration
- [ ] On success: navigates to Catalog (`/`)
- [ ] On failure: shows inline error (e.g., "Invalid webappId or schema fetch failed")

---

### Task T-16: Catalog Page
**Files**: `client/src/pages/Catalog.tsx`
**Dependencies**: T-11, T-13, T-21
**Effort**: 1.5 hours
**Acceptance Criteria**:
- [ ] Fetches tool list on mount via `useTools().fetchTools()`
- [ ] Displays tool cards with: `webappName`, `webappId` (truncated), first 3 `tags`, `createdAt`, `updatedAt`, `taskCount`
- [ ] Search input filters by `webappName` (client-side, case-insensitive, debounced 300ms)
- [ ] Tag filter dropdown (multi-select) from unique tags across all tools
- [ ] Clicking a tool card navigates to `/tools/:id/run`
- [ ] Each tool card has a delete button that opens `ConfirmDialog`
- [ ] On delete confirm: calls `deleteTool(id)`, removes tool from list without full page reload
- [ ] Empty state message when no tools registered
- [ ] Loading state while fetching
- [ ] Error state if fetch fails

---

### Task T-17: DynamicField Components
**Files**:
- `client/src/components/DynamicField.tsx`
- `client/src/components/DynamicField/FileUploader.tsx`
- `client/src/components/DynamicField/TextInput.tsx`
- `client/src/components/DynamicField/Dropdown.tsx`
- `client/src/components/DynamicField/Switch.tsx`
- `client/src/components/DynamicField/LoraSelector.tsx`
- `client/src/components/DynamicField/NumberInput.tsx`
**Dependencies**: T-10, T-3
**Effort**: 2 hours
**Acceptance Criteria**:
- [ ] `DynamicField.tsx` uses `FIELD_COMPONENTS` Map to dispatch to sub-components by `fieldType`
- [ ] Renders label with `*` indicator for required fields
- [ ] Shows `fieldData.description` as help text below input
- [ ] Shows inline validation error per field
- [ ] `FileUploader.tsx` handles `IMAGE` (preview thumbnail), `AUDIO` (audio player), `VIDEO` (video player), `FILE` (name + size)
- [ ] FileUploader validates accepted file types per spec FR-03-AC2
- [ ] FileUploader shows 50MB size warning
- [ ] `TextInput.tsx` renders `<input type="text">` or `<textarea>` based on `fieldData.multiline`
- [ ] `Dropdown.tsx` renders `<select>` with options parsed from `fieldData` JSON
- [ ] `Switch.tsx` renders checkbox/toggle
- [ ] `LoraSelector.tsx` renders text input (free-text)
- [ ] `NumberInput.tsx` renders `<input type="number">` with `min`/`max` constraints from `fieldData`
- [ ] All sub-components accept `field`, `value`, `onChange` props

---

### Task T-18: Tool Runner Page
**Files**: `client/src/pages/ToolRunner.tsx`
**Dependencies**: T-11, T-13, T-17
**Effort**: 1.5 hours
**Acceptance Criteria**:
- [ ] Fetches tool by `:id` from URL params via `useTasks().fetchTask(id)` or direct API call
- [ ] Renders tool header: `webappName`, `webappId`
- [ ] Renders dynamic form using `DynamicField` components from the tool's `nodeInfoList`
- [ ] Client-side validation before submit: required fields, INT min/max, file size (< 50MB)
- [ ] On submit: uploads file-type fields first via `POST /api/upload`, then calls `POST /api/tasks/run` with updated fieldValues
- [ ] Shows per-field loading state during uploads
- [ ] On success: navigates to `/history/:newTaskId`
- [ ] On failure: shows inline error, preserves form state
- [ ] Loading state while tool data loads

---

### Task T-19: Task History Page
**Files**: `client/src/pages/TaskHistory.tsx`
**Dependencies**: T-11, T-13, T-21
**Effort**: 1 hour
**Acceptance Criteria**:
- [ ] Fetches task list on mount via `useTasks().fetchTasks()`
- [ ] Each row displays: `toolName`, `status` (StatusBadge), `createdAt`, `completedAt`, result file count
- [ ] Search input filters by `toolName` client-side
- [ ] Status filter dropdown (multi-select: PENDING, RUNNING, COMPLETED, FAILED, EXPIRED)
- [ ] Clicking a row navigates to `/history/:id`
- [ ] Empty state when no tasks exist
- [ ] Loading and error states

---

### Task T-20: Task Detail Page
**Files**: `client/src/pages/TaskDetail.tsx`
**Dependencies**: T-11, T-13, T-21
**Effort**: 2 hours
**Acceptance Criteria**:
- [ ] Uses `usePolling(taskId)` to poll task status every 5 seconds
- [ ] Displays task metadata: `id`, `taskId`, `toolName`, `createdAt`, `completedAt`
- [ ] Shows `StatusBadge` for current status
- [ ] Animated status transitions: PENDING (pulsing yellow dot + "Queued"), RUNNING (spinning icon + "Running"), COMPLETED (green checkmark), FAILED (red X), EXPIRED (gray icon)
- [ ] On `COMPLETED`: shows download links for each result file via `/api/download/:taskId/:nodeId`
- [ ] On `FAILED`: shows `errorMessage` and `failedReason` inline
- [ ] Delete button with `ConfirmDialog` confirmation
- [ ] After delete, navigates back to `/history`
- [ ] Loading state while initial task loads
- [ ] Stops polling when status is terminal

---

### Task T-21: Shared Components
**Files**: `client/src/components/StatusBadge.tsx`, `client/src/components/ConfirmDialog.tsx`
**Dependencies**: T-10
**Effort**: 1 hour
**Acceptance Criteria**:
- [ ] `StatusBadge` accepts `status: TaskStatus`, renders colored icon + label per FR-05-AC8
- [ ] StatusBadge uses CSS classes: pending (yellow/pulse), running (spinning), completed (green), failed (red), expired (gray)
- [ ] `ConfirmDialog` renders a modal overlay with title, message, confirm button, cancel button
- [ ] ConfirmDialog has `isOpen`, `title`, `message`, `onConfirm`, `onCancel` props
- [ ] ConfirmDialog closes on cancel click and overlay click
- [ ] ConfirmDialog has a "danger" variant for destructive actions

---

## Phase 5: Integration & Polish

### Task T-22: Wire Up End-to-End
**Files**: All page components, `App.tsx` (router adjustments)
**Dependencies**: T-14, T-15, T-16, T-18, T-19, T-20
**Effort**: 1 hour
**Acceptance Criteria**:
- [ ] Full register → run → complete flow works end-to-end
- [ ] All navigation links work correctly
- [ ] Route parameter passing works (tool id → runner, task id → detail)
- [ ] KeyIsSet indicator updates across all pages after settings change
- [ ] After registering a tool, it appears in catalog immediately
- [ ] After running a tool, task detail shows with correct status
- [ ] Delete operations cascade correctly
- [ ] All pages render without console errors

### Task T-23: Error Handling & Edge Cases
**Files**: All page components, `client/src/api/index.ts`, `server/src/index.ts`
**Dependencies**: T-22
**Effort**: 1 hour
**Acceptance Criteria**:
- [ ] All API error responses are parsed and displayed as user-friendly messages
- [ ] Network errors show "Network error — is the server running?" message
- [ ] Loading states shown on all pages during fetch operations
- [ ] Empty states shown when no data exists (no tools, no tasks)
- [ ] 404 states on detail pages when resource doesn't exist
- [ ] Server errors (500) show generic error message
- [ ] Form validation errors shown inline on all forms
- [ ] Graceful degradation if RH API is unreachable (backend returns meaningful errors)
- [ ] CSS polish: consistent spacing, alignment, responsive behavior

---

## Review Workload Forecast

- **Total estimated changed lines**: ~2,550 lines across 40+ files
- **Chained PRs recommended**: **YES** (exceeds 400 lines threshold by ~6x)
- **Suggested split**:
  - **PR 1**: Phase 1 (Foundation) + Phase 2 (Backend API) — ~750 lines
  - **PR 2**: Phase 3 (Frontend Shell) + Phase 4 (Pages) — ~1,500 lines
  - **PR 3**: Phase 5 (Integration & Polish) — ~300 lines
- **Decision needed before apply**:
  - Approve task breakdown and effort estimates
  - Confirm chained PR split strategy
  - Decide on CSS approach: plain CSS, CSS modules, or CSS-in-JS
  - Decide whether uploads/downloads path config is MVP or stretch

---

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-05-24 | Initial task breakdown from spec + design | SDD Tasks |
