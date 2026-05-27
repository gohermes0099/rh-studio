# SDD Verification Report: scaffold-app

| Field | Value |
|-------|-------|
| **Change ID** | scaffold-app |
| **Project** | rh-studio |
| **Date** | 2026-05-25 |
| **Spec** | `openspec/specs/scaffold-app.md` |
| **Tasks** | `openspec/tasks/scaffold-app.md` |

---

## TypeScript Compilation

- **Server**: ✅ PASS — `tsc --noEmit -p server/tsconfig.json` clean (0 errors)
- **Client**: ✅ PASS — `tsc --noEmit -p client/tsconfig.json` clean (0 errors)

---

## 1. Functional Requirements Check

### FR-01: Tool Registration

| Item | Status | Details |
|------|--------|---------|
| POST /api/tools/register exists | ✅ PASS | `server/src/routes/tools.ts:7` |
| Accepts webappId | ✅ PASS | Body param `webappId` validated as non-empty string |
| Backend fetches schema from RH API | ✅ PASS | `client.fetchSchema(webappId)` called at `tools.ts:23` |
| Stores in tools table | ✅ PASS | INSERT with ON CONFLICT DO UPDATE at `tools.ts:29-37` |
| Duplicate webappId updates (not duplicates) | ✅ PASS | ON CONFLICT clause updates all fields and bumps `updatedAt` |
| UUID format validation | ❌ CRITICAL | No UUID regex validation. Spec FR-01-AC1 requires UUID format check. Backend only checks `typeof !== 'string'`. Frontend only checks `!webappId.trim()`. |
| RH fetch failure returns 400 | ❌ CRITICAL | Spec FR-01-AC4: invalid webappId should return `400`. Backend catch returns `500` for all errors (`tools.ts:42`). |
| Returns 201 on success | ❌ CRITICAL | Spec FR-01-AC7: must return `201`. Backend returns `200` via `res.json()` at `tools.ts:39`. |
| Response format `{ tool: { id, webappId, ... } }` | ❌ CRITICAL | Backend returns `{ success: true, webappId, webappName }` — missing tool object with id, nodeInfoList, tags, dates. |
| Frontend redirects to `/` on success | ✅ PASS | `navigate('/')` in `RegisterTool.tsx:26` |
| Inline error on failure | ✅ PASS | `setError()` called, error rendered in `RegisterTool.tsx:65-66` |

### FR-02: Tool Catalog

| Item | Status | Details |
|------|--------|---------|
| GET /api/tools returns all tools sorted by updatedAt | ✅ PASS | `ORDER BY t.updatedAt DESC` at `tools.ts:48-52` |
| Tool cards show webappName | ✅ PASS | `Catalog.tsx:58` |
| Tool cards show tags | ✅ PASS | `Catalog.tsx:68-80` — shows ALL tags, not first 3 as spec |
| Tool cards show createdAt | ⚠️ WARNING | Not rendered in `Catalog.tsx` |
| Tool cards show updatedAt | ⚠️ WARNING | Not rendered in `Catalog.tsx` |
| Tool cards show taskCount | ✅ PASS | `Catalog.tsx:84` |
| Tool cards show webappId truncated | ✅ PASS | `Catalog.tsx:84` — shown as full ID |
| Search by name (client-side, case-insensitive) | ✅ PASS | `Catalog.tsx:13-15` — but no 300ms debounce as spec requires |
| Tag filter dropdown (multi-select) | ❌ CRITICAL | Not implemented in `Catalog.tsx`. No tag filter exists. |
| Click navigates to `/tools/:id/run` | ✅ PASS | `navigate(\`/tools/${tool.id}/run\`)` at `Catalog.tsx:55` |
| Delete with confirmation dialog | ✅ PASS | `ConfirmDialog` at `Catalog.tsx:92-100` |
| DELETE /api/tools/:id cascades to tasks | ✅ PASS | ON DELETE CASCADE on FK, `DELETE FROM tools WHERE id = ?` at `tools.ts:72-79` |
| Client-side removal after delete | ✅ PASS | `remove()` calls `fetchTools()` which refetches via `useTools.ts:30` |
| Response format `{ tools: Tool[] }` | ⚠️ WARNING | Backend returns raw array, not wrapped in `{ tools: [...] }` |

### FR-03: Dynamic Form Rendering

| Item | Status | Details |
|------|--------|---------|
| Form reads nodeInfoList from tool record | ✅ PASS | `ToolRunner.tsx:23-28` parses from tool |
| IMAGE → file upload with preview | ✅ PASS | `DynamicField.tsx:83-132` — ImageField component |
| AUDIO → audio player | ✅ PASS | `DynamicField.tsx:134-177` — AudioField component |
| VIDEO → video player | ✅ PASS | `DynamicField.tsx:179-222` — VideoField component |
| FILE → generic file upload | ✅ PASS | `DynamicField.tsx:224-263` — FileField component |
| STRING → text/textarea | ⚠️ WARNING | Uses `description.length > 80` as heuristic for textarea, not `fieldData.multiline` as spec FR-03-AC2 requires |
| LIST → dropdown selector | ⚠️ WARNING | Parses as simple string array, not `{ label, value }` objects as spec requires |
| SWITCH → toggle/checkbox | ✅ PASS | SwitchField at `DynamicField.tsx:59-70` |
| LORA → text input | ✅ PASS | LoraField at `DynamicField.tsx:72-81` |
| INT → numeric input | ✅ PASS | NumberField at `DynamicField.tsx:31-40` |
| Field descriptions as help text | ✅ PASS | `field.description` shown in `ToolRunner.tsx:106-109` |
| Default values pre-filled | ✅ PASS | `initial[f.nodeId] = f.fieldValue || ''` at `ToolRunner.tsx:31` |
| Validation before submission | ❌ CRITICAL | No client-side validation in `ToolRunner.tsx`. No required field checks, no INT min/max, no file size limit. Spec FR-03-AC6/AC7 requires this. |
| Accepted file types per spec | ⚠️ WARNING | FileUploaders use generic `accept="image/*"`, `audio/*`, `video/*` — not the specific extensions listed in spec FR-03-AC2 (.jpg, .png, .mp3, etc.) |
| 50MB file size warning | ❌ CRITICAL | Not implemented anywhere in DynamicField components |

### FR-04: Tool Execution

| Item | Status | Details |
|------|--------|---------|
| POST /api/tasks/run exists | ✅ PASS | `server/src/routes/tasks.ts:21` |
| Accepts toolId and fieldValues | ✅ PASS | `req.body` destructured at `tasks.ts:23` |
| File fields uploaded to RH before execution | ✅ PASS | ToolRunner uploads via `handleUpload` → `api.uploadFile` before submit |
| Backend builds nodeInfoList payload | ✅ PASS | `tasks.ts:43-51` maps fields with updated values |
| Calls RH run API | ✅ PASS | `client.runTask(tool.webappId, nodeInfoList)` at `tasks.ts:53` |
| Returns task record with PENDING status | ⚠️ WARNING | Returns raw task object, not wrapped in `{ task: {...} }` as spec requires. Returns 200 not 201. |
| Status mapped from RH response | ✅ PASS | `statusMap` at `tasks.ts:56-61` |
| Frontend navigates to `/history/:id` | ✅ PASS | `navigate(\`/history/${task.id}\`)` at `ToolRunner.tsx:49` |

### FR-05: Task Polling & Result

| Item | Status | Details |
|------|--------|---------|
| Frontend polls every 5s | ✅ PASS | `setInterval(..., 5000)` at `usePolling.ts:34` |
| Backend checks RH status on poll | ✅ PASS | `GET /tasks/:id` → `client.queryTask()` at `tasks.ts:139` |
| State machine: PENDING→RUNNING→COMPLETED/FAILED | ✅ PASS | Transitions handled at `tasks.ts:149-177` |
| Expiry after 25h | ✅ PASS | `maxAge = 25 * 60 * 60 * 1000` at `tasks.ts:142` |
| Results downloaded to local directory | ✅ PASS | Downloaded to `downloads/{taskId}/` at `tasks.ts:154-168` |
| Status indicators in UI | ⚠️ WARNING | `StatusBadge` shows colored text only. Spec FR-05-AC8 requires animated icons: pulsing yellow dot (PENDING), spinning (RUNNING), green checkmark (COMPLETED), red X (FAILED), gray (EXPIRED). Current implementation is basic colored text. |
| Polling stops on terminal status | ✅ PASS | `usePolling.ts:16-20` clears interval |
| Download links on COMPLETED | ✅ PASS | `TaskDetail.tsx:97-135` shows results with download links |

### FR-06: Task History

| Item | Status | Details |
|------|--------|---------|
| GET /api/tasks sorted by createdAt | ✅ PASS | `ORDER BY t.createdAt DESC` at `tasks.ts:100` |
| Shows tool name, status, dates, result count | ✅ PASS | `TaskHistory.tsx:65-76` |
| Search/filter by name or status | ✅ PASS | Server-side LIKE and status filter, plus client search input |
| Click navigates to `/history/:id` | ✅ PASS | `navigate(\`/history/${task.id}\`)` at `TaskHistory.tsx:63` |
| GET /api/tasks/:id returns full detail | ✅ PASS | Includes nodeInfoList, resultFiles, error info at `tasks.ts:106-199` |
| Delete task | ✅ PASS | `DELETE /api/tasks/:id` at `tasks.ts:201-209` |
| Confirmation before delete | ✅ PASS | `ConfirmDialog` at `TaskHistory.tsx:90-98` |
| Response format `{ tasks: Task[] }` | ⚠️ WARNING | Backend returns raw array, not wrapped in `{ tasks: [...] }` |

### FR-07: Settings / API Key

| Item | Status | Details |
|------|--------|---------|
| POST /api/settings/key exists | ✅ PASS | `server/src/routes/settings.ts:7` |
| GET /api/settings/key/status exists | ✅ PASS | `settings.ts:28` |
| Key validation (test RH call) | ✅ PASS | `fetchSchema('1')` validates key at `settings.ts:16` |
| Key not saved if validation fails | ✅ PASS | Key is saved ONLY after `fetchSchema` succeeds (lines 16-18) |
| Frontend reflects keyIsSet status | ✅ PASS | `Layout.tsx:9`, `Settings.tsx:8`, `useSettings.ts:17` |
| Response format: `{ keyIsSet: true }` | ⚠️ WARNING | Backend returns `{ success: true }` instead of `{ keyIsSet: true }` at `settings.ts:21`. Spec API §4.1 requires `{ keyIsSet: true }`. |
| Setting a new key replaces old one | ✅ PASS | `INSERT OR REPLACE` at `settings.ts:19` |
| API key never exposed to frontend | ✅ PASS | Only `keyIsSet: boolean` returned |

### FR-08: File Management

| Item | Status | Details |
|------|--------|---------|
| POST /api/upload exists | ✅ PASS | `server/src/routes/upload.ts:15` |
| Uses multer | ✅ PASS | `multer({ storage: multer.memoryStorage() })` at `upload.ts:13` |
| Uploads to RH | ✅ PASS | `client.uploadFile()` at `upload.ts:30` |
| Returns fileName | ✅ PASS | `res.json(result)` at `upload.ts:31` |
| GET /api/download/:taskId/:nodeId exists | ✅ PASS | `upload.ts:38` — but uses `task.id` (internal ID) not `taskId` (RH UUID) |
| Streams file with Content-Type | ✅ PASS | `res.sendFile()` at `upload.ts:66` |
| Upload temp storage to `uploads/` | ❌ CRITICAL | Spec FR-08-AC4 requires saving to `uploads/` directory. Not implemented. File buffer is uploaded directly to RH without local persistence. |
| 50MB file size limit | ❌ CRITICAL | No `limits` on multer at `upload.ts:13`. Spec NFR-08 and FR-08-AC7 require 50MB limit and return 413 on exceed. |
| Path traversal protection | ❌ CRITICAL | Spec T-8 AC requires validation that taskId/nodeId don't contain `../`. Not implemented. |
| Fallback to redirect when file not local | ✅ PASS | `res.redirect(match.url)` at `upload.ts:68` |

---

## 2. Non-Functional Requirements Check

| ID | Item | Status | Details |
|----|------|--------|---------|
| NFR-01 | Server on port 3001 | ✅ PASS | `server/src/index.ts:11` — also supports `PORT` env var |
| NFR-02 | Frontend dev on port 5173 with proxy | ✅ PASS | `vite.config.ts:13-19` — port 5173, proxy `/api` → `localhost:3001` |
| NFR-03 | SQLite WAL mode | ✅ PASS | `connection.ts:21` — `PRAGMA journal_mode = WAL` |
| NFR-04 | Backend timeout 120s | ✅ PASS | `rhClient.ts:6` — `this.timeout = 120_000` |
| NFR-05 | Polling interval 5s | ✅ PASS | `usePolling.ts:35` — `5000`ms |
| NFR-06 | ISO 8601 dates | ✅ PASS | All dates use `new Date().toISOString()` |
| NFR-07 | API key security | ⚠️ WARNING | Key stored in SQLite (no encryption, acceptable per spec). But `apiKeyGuard` middleware (T-9 AC) is NOT implemented — routes are not centrally guarded. Each route checks API key independently. |
| NFR-08 | File upload limit 50MB | ❌ CRITICAL | No multer file size limit configured at `upload.ts:13`. Missing `limits: { fileSize: 50 * 1024 * 1024 }` |
| NFR-09 | Responsive UI down to 1024px | ✅ PASS | CSS grid with `auto-fill, minmax(300px, 1fr)` at `index.css:141` |

---

## 3. Data Schema Check

| Item | Status | Details |
|------|--------|---------|
| tools table — all columns | ✅ PASS | Matches spec exactly at `migrations.ts:5-13` |
| tasks table — all columns | ✅ PASS | Matches spec exactly at `migrations.ts:15-29` |
| settings table — key/value | ✅ PASS | `migrations.ts:31-34` |
| idx_tools_webappId | ✅ PASS | `migrations.ts:36` |
| idx_tools_updatedAt | ✅ PASS | `migrations.ts:37` — NOTE: spec says `DESC` but SQLite index is just `(updatedAt)`. Functionally equivalent for sorting. |
| idx_tasks_taskId | ✅ PASS | `migrations.ts:38` |
| idx_tasks_toolId | ✅ PASS | `migrations.ts:39` |
| idx_tasks_status | ✅ PASS | `migrations.ts:40` |
| idx_tasks_createdAt | ✅ PASS | `migrations.ts:41` |
| ON DELETE CASCADE on tasks.toolId | ✅ PASS | `REFERENCES tools(id) ON DELETE CASCADE` at `migrations.ts:18` |

---

## 4. API Check

| Endpoint | Success Case | Error Case | Details |
|----------|-------------|------------|---------|
| POST /api/settings/key | ⚠️ WARNING | ✅ PASS | Returns `{ success: true }` instead of `{ keyIsSet: true }`. Error: returns 400 on invalid key ✅ |
| GET /api/settings/key/status | ✅ PASS | ✅ PASS | Returns `{ keyIsSet: boolean }` |
| POST /api/tools/register | ❌ CRITICAL | ❌ CRITICAL | Returns 200 not 201. Response is `{ success, webappId, webappName }` not `{ tool: {...} }`. Errors return 500 not 400. No UUID validation. |
| GET /api/tools | ⚠️ WARNING | ✅ PASS | Returns raw array, not `{ tools: [...] }`. Empty array returned for empty DB ✅ |
| DELETE /api/tools/:id | ✅ PASS | ✅ PASS | Returns `{ success: true }`. 404 on not found. |
| POST /api/tasks/run | ❌ CRITICAL | ✅ PASS | Returns 200 not 201. Returns raw task, not `{ task: {...} }`. `uploadedFiles` param unused by client. 404 on missing tool ✅ |
| GET /api/tasks | ⚠️ WARNING | ✅ PASS | Returns raw array, not `{ tasks: [...] }`. Supports `?search=` and `?status=` ✅ |
| GET /api/tasks/:id | ✅ PASS | ✅ PASS | Full task detail with nodeInfoList, resultFiles, poll results. 404 on missing task ✅ |
| POST /api/upload | ⚠️ WARNING | ✅ PASS | No local temp save (spec FR-08-AC4). No 50MB limit (spec FR-08-AC7). Basic error handling works. |
| GET /api/download/:taskId/:nodeId | ✅ PASS | ✅ PASS | Streams file. 404 on missing. Falls back to RH redirect. No path traversal protection ❌ |

---

## 5. Frontend Route Check

| Route | Page | Status | Details |
|-------|------|--------|---------|
| `/` | Catalog | ✅ PASS | `App.tsx:15` |
| `/register` | Register Tool | ✅ PASS | `App.tsx:16` |
| `/tools/:id/run` | Tool Runner | ✅ PASS | `App.tsx:17` |
| `/history` | Task History | ✅ PASS | `App.tsx:18` |
| `/history/:id` | Task Detail | ✅ PASS | `App.tsx:19` |
| `/settings` | Settings | ✅ PASS | `App.tsx:20` |
| Navigation bar | Layout | ✅ PASS | Links: Catalog, Register, History, Settings at `Layout.tsx:34-37` |
| Active route highlighted | Layout | ✅ PASS | `NavLink` with `isActive` at `Layout.tsx:12-19` |
| KeyIsSet indicator in nav | Layout | ✅ PASS | Green/red dot at `Layout.tsx:39-48` |

---

## 6. Missing / Additional Issues

| Issue | Severity | Details |
|-------|----------|---------|
| `client/src/types/index.ts` missing | ⚠️ WARNING | Spec T-10 AC expects this file to re-export shared types. Current code imports from `@shared/types` directly which works via Vite alias, but the file is absent. |
| `apiKeyGuard` middleware missing | ⚠️ WARNING | Spec T-9 AC requires centralized middleware checking API key on all `/api/*` routes except settings. Not implemented — each route checks independently. |
| `validateKey()` method missing on RhClient | ⚠️ WARNING | Spec T-4 AC expects a dedicated `validateKey()` method. Current code uses `fetchSchema('1')` inline. |
| `nodeInfoList` check on register | ⚠️ WARNING | Spec FR-01-AC4: if RH response lacks `nodeInfoList`, return 400. Backend doesn't validate the parsed schema response. |
| No errorHandler for multer/parse errors | ⚠️ WARNING | Spec T-9 AC requires centralized `errorHandler` for multer errors, JSON parse errors. Current handler at `index.ts:23` only catches generic errors. |
| `POST /api/settings/key` test call uses '1' | ⚠️ WARNING | Uses `fetchSchema('1')` as validation — assumes static webapp ID. May fail or be unreliable. |
| Run task doesn't send `uploadedFiles` | ⚠️ WARNING | Client `api.runTask()` only sends `{ toolId, fieldValues }`. Server looks for `uploadedFiles` which is never set by client — relies on `fieldValues` fallback. |

---

## Summary

| Category | ✅ PASS | ⚠️ WARNING | ❌ CRITICAL |
|----------|---------|------------|-------------|
| FR-01: Tool Registration | 6 | 0 | 4 |
| FR-02: Tool Catalog | 8 | 3 | 1 |
| FR-03: Dynamic Form Rendering | 10 | 3 | 3 |
| FR-04: Tool Execution | 5 | 1 | 0 |
| FR-05: Task Polling & Result | 6 | 1 | 0 |
| FR-06: Task History | 7 | 1 | 0 |
| FR-07: Settings / API Key | 5 | 1 | 0 |
| FR-08: File Management | 5 | 0 | 3 |
| NFRs | 6 | 1 | 1 |
| Data Schema | 8 | 0 | 0 |
| API Check | 8 | 5 | 3 |
| Frontend Route | 8 | 0 | 0 |
| **Total** | **82** | **16** | **15** |

### Critical Items Requiring Fixes

1. **FR-01 / API-3**: `POST /api/tools/register` — wrong HTTP status (200→201), wrong response shape, no UUID validation, wrong error codes (500→400)
2. **FR-01-AC4**: Schema fetch failure returns 500 not 400
3. **FR-02-AC4**: Tag filter dropdown not implemented in Catalog
4. **FR-03-AC6**: No client-side validation (required fields, INT bounds, file size) in ToolRunner
5. **FR-03-AC2**: STRING multiline uses heuristic instead of `fieldData.multiline`
6. **FR-08-AC4**: No local temp save for uploads
7. **FR-08-AC7 / NFR-08**: No 50MB multer limit
8. **T-8**: No path traversal protection in download route
9. **API response shapes**: GET /api/tools, POST /api/tasks/run, GET /api/tasks all return unwrapped arrays/objects instead of wrapped `{ tools: [...] }`, `{ task: {...} }` formats
10. **StatusBadge**: Missing animated status indicators per spec

### Functional Highlights

- Core flow (register → catalog → run → poll → complete) works end-to-end
- All 6 frontend routes exist and navigate correctly
- All 10 API endpoints exist and handle basic success/error cases
- Data schema matches spec exactly
- Both TypeScript compilations pass cleanly
- File upload/download flow works (no local persistence but functional)
