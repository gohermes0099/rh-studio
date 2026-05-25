# SDD Specification: Scaffold App — RH Studio Foundation

| Field | Value |
|-------|-------|
| **Change ID** | scaffold-app |
| **Status** | ✅ Specified |
| **Proposal** | `openspec/proposals/scaffold-app.md` |
| **Spec** | `openspec/specs/scaffold-app.md` |

---

## 1. Functional Requirements

### FR-01: Tool Registration

**Description**: User enters a RunningHub `webappId` (UUID), backend fetches the app schema from the RH API, parses it, and persists it to the local SQLite `tools` table.

**Acceptance Criteria**:
- FR-01-AC1: A form input accepts a `webappId` string (UUID format). Form validates non-empty UUID format before submission.
- FR-01-AC2: On submit, `POST /api/tools/register` sends `{ webappId }` to the backend.
- FR-01-AC3: Backend calls `GET /api/webapp/apiCallDemo?webappId={webappId}` on the RH API using the stored API key. Response must include `nodeInfoList` with field definitions.
- FR-01-AC4: If RH API returns a non-2xx status or the response lacks `nodeInfoList`, backend returns `400 { error: "Invalid webappId or schema fetch failed" }`.
- FR-01-AC5: On success, backend stores the tool record in the `tools` table with parsed schema and `createdAt`/`updatedAt` timestamps.
- FR-01-AC6: If a tool with the same `webappId` already exists, the record is **updated** (schema refreshed, `updatedAt` bumped) — not duplicated.
- FR-01-AC7: Backend returns `201 { tool: { id, webappId, webappName, nodeInfoList, tags, createdAt, updatedAt } }`.
- FR-01-AC8: Frontend redirects to the catalog page (`/`) on success, or shows an inline error message on failure.

---

### FR-02: Tool Catalog

**Description**: Lists all registered tools with search and filter capabilities. Users can delete tools.

**Acceptance Criteria**:
- FR-02-AC1: `GET /api/tools` returns `{ tools: Tool[] }` sorted by `updatedAt` descending.
- FR-02-AC2: Each tool card displays: `webappName`, `webappId` (truncated), first 3 `tags`, `createdAt`, `updatedAt`, count of past tasks.
- FR-02-AC3: A search input filters tools by `webappName` (client-side string match, case-insensitive, debounced 300ms).
- FR-02-AC4: A tag filter dropdown (multi-select) filters tools. Tag options are derived from all unique tags across registered tools.
- FR-02-AC5: Clicking a tool card navigates to `/tools/:id/run`.
- FR-02-AC6: Each tool card has a delete button with a confirmation dialog ("Are you sure you want to delete this tool? All associated task history will also be deleted.").
- FR-02-AC7: `DELETE /api/tools/:id` removes the tool and cascades to delete all associated tasks. Returns `200 { success: true }`.
- FR-02-AC8: After deletion, the tool disappears from the catalog without a page reload (client-side removal or refetch).

---

### FR-03: Dynamic Form Rendering

**Description**: A generic form rendered from the tool's `nodeInfoList`. Each item in `nodeInfoList` maps to an input component based on its `fieldType`.

**Acceptance Criteria**:
- FR-03-AC1: Form reads `nodeInfoList` from the fetched tool record. No per-tool hardcoded forms.
- FR-03-AC2: Each field renders based on its `fieldType`:

  | `fieldType` | Component | Behavior |
  |---|---|---|
  | `IMAGE` | File upload with image preview | Accept `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`. Preview thumbnail shown after selection. |
  | `AUDIO` | File upload with audio player | Accept `.mp3`, `.wav`, `.ogg`, `.m4a`. Audio player shown after selection. |
  | `VIDEO` | File upload with video player | Accept `.mp4`, `.webm`, `.mov`. Video player shown after selection. |
  | `FILE` | Generic file upload | Accept any file type. File name and size shown after selection. |
  | `STRING` | Text input or textarea | Render `<input type="text">` for single-line. If `fieldData` contains `multiline: true`, render `<textarea>`. |
  | `LIST` | Dropdown selector | Options parsed from `fieldData` JSON (array of `{ label, value }`). `<select>` element. |
  | `SWITCH` | Toggle / checkbox | Render `<input type="checkbox">` or toggle switch component. |
  | `LORA` | LoRA selector | Text input with autocomplete from known LoRAs (or free-text if not enumerated). |
  | `INT` | Numeric input | Render `<input type="number">`. Apply `min`/`max` constraints from `fieldData` if present. |

- FR-03-AC3: Each field displays its `fieldName` as the label. If `fieldData` contains a `description`, show it as help text below the input.
- FR-03-AC4: Each field pre-fills its `fieldValue` as the default value.
- FR-03-AC5: Required fields (from `fieldData.required`) display a visual indicator (`*`).
- FR-03-AC6: Client-side validation before submission:
  - Required fields must have a value.
  - INT fields must be valid integers within `min`/`max` bounds.
  - File uploads must not exceed 50MB (warn if > 50MB).
- FR-03-AC7: Validation errors are shown inline below each field and block form submission.

---

### FR-04: Tool Execution

**Description**: User fills the dynamic form and submits. Backend processes file uploads, builds the `nodeInfoList`, calls the RH run API, and returns a `taskId`.

**Acceptance Criteria**:
- FR-04-AC1: User clicks "Run" → form validates (FR-03-AC6) → `POST /api/tasks/run` with `{ toolId, fieldValues: { nodeId: value }[] }`.
- FR-04-AC2: For each field with `fieldType` in `[FILE, IMAGE, AUDIO, VIDEO]`:
  - If the value is a new file (not previously uploaded), backend uploads via RH upload API and obtains a `fileName`.
  - The `fileName` replaces the value in the `nodeInfoList`.
- FR-04-AC3: Backend constructs `nodeInfoList` payload with updated `fieldValue` entries.
- FR-04-AC4: Backend calls `POST /openapi/v2/run/ai-app/{webappId}` on RH API with the constructed payload.
- FR-04-AC5: On successful run API response, backend extracts `taskId` and inserts a new record in the `tasks` table with status `PENDING`.
- FR-04-AC6: Backend returns `201 { task: { id, taskId, toolId, status: "PENDING", createdAt } }`.
- FR-04-AC7: Frontend navigates to the task detail page (`/history/:id`) for the new task.

---

### FR-05: Task Polling & Result

**Description**: Backend polls the RH API for task status every 5 seconds. On completion, downloads results. Frontend shows real-time status.

**Acceptance Criteria**:
- FR-05-AC1: After task creation, the task detail page begins polling `GET /api/tasks/:id` every 5 seconds.
- FR-05-AC2: Backend, on each poll request, calls `POST /openapi/v2/query` with `{ taskId }` to check task status.
- FR-05-AC3: Task state machine transitions:

  ```
  PENDING ──► RUNNING ──► COMPLETED
                    │
                    └──► FAILED
  ```

  After 25 hours in PENDING or RUNNING, status becomes `EXPIRED`.
- FR-05-AC4: On `COMPLETED`: backend downloads all result files from RH (result URLs), saves to local directory, updates task record with file paths and `completedAt`.
- FR-05-AC5: On `FAILED`: backend captures `errorMessage` and `failedReason` from RH response, updates task record.
- FR-05-AC6: On `EXPIRED`: backend marks task as expired, stops polling.
- FR-05-AC7: Backend updates `task.status` and `task.updatedAt` on every state change. The `tasks` table persists the complete state.
- FR-05-AC8: Frontend shows a visual status indicator:
  - `PENDING` → pulsing yellow dot + "Queued"
  - `RUNNING` → spinning/animated icon + "Running"
  - `COMPLETED` → green checkmark + "Completed"
  - `FAILED` → red X + "Failed" + error message inline
  - `EXPIRED` → gray icon + "Expired"
- FR-05-AC9: When polling reaches `COMPLETED`, frontend stops polling and shows result download links.
- FR-05-AC10: When polling reaches `FAILED` or `EXPIRED`, frontend stops polling and shows the error.

---

### FR-06: Task History

**Description**: Lists all past tasks with search and detail views. Users can delete history entries.

**Acceptance Criteria**:
- FR-06-AC1: `GET /api/tasks` returns `{ tasks: Task[] }` sorted by `createdAt` descending.
- FR-06-AC2: Each row displays: tool name (joined from tools table), `status`, `createdAt`, `completedAt`, number of result files.
- FR-06-AC3: Search/filter by tool name or status.
- FR-06-AC4: Clicking a task row navigates to `/history/:id`.
- FR-06-AC5: `GET /api/tasks/:id` returns full task detail including:
  - All task metadata (id, taskId, toolId, status, dates)
  - The complete `nodeInfoList` payload used for execution
  - Result file paths / download URLs
  - Error info if failed (errorMessage, failedReason)
- FR-06-AC6: Task detail page has a "Delete" button. `DELETE /api/tasks/:id` removes the task record. Returns `200 { success: true }`.
- FR-06-AC7: Frontend confirms deletion before sending.

---

### FR-07: Settings / API Key

**Description**: Form to enter, save, and validate the RH API key. Backend never exposes the full key — only a `keyIsSet` boolean.

**Acceptance Criteria**:
- FR-07-AC1: `GET /api/settings/key/status` returns `{ keyIsSet: boolean }`. Frontend uses this to show "API Key: Configured ✓" or "API Key: Not Set".
- FR-07-AC2: Settings page has a secure text input (type="password") for the API key.
- FR-07-AC3: Submit sends `POST /api/settings/key` with `{ apiKey: string }`.
- FR-07-AC4: Backend saves the key to the `settings` table and immediately validates it by making a test RH API call (e.g., fetching a known webapp schema or a health check).
- FR-07-AC5: If validation succeeds, returns `200 { keyIsSet: true }`.
- FR-07-AC6: If validation fails (RH API rejects the key), returns `400 { error: "Invalid API key", keyIsSet: false }`. Key is NOT saved.
- FR-07-AC7: Setting a new key replaces the old one (upsert).
- FR-07-AC8: Frontend reflects the new `keyIsSet` status immediately after submission.

---

### FR-08: File Management

**Description**: File upload (frontend → backend → RH) and download (RH → backend → local storage) flows.

**Acceptance Criteria**:
- FR-08-AC1: Frontend sends file as `multipart/form-data` to `POST /api/upload`.
- FR-08-AC2: Backend uses `multer` to receive the file, then uploads it to the RH upload API.
- FR-08-AC3: Backend returns `{ fileName: string }` from the RH response.
- FR-08-AC4: Backend stores uploaded files temporarily in an `uploads/` directory (configurable via settings).
- FR-08-AC5: On task completion, backend downloads result files from RH result URLs to a `downloads/` directory (configurable via settings).
- FR-08-AC6: `GET /api/download/:taskId/:nodeId` serves the downloaded result file to the frontend.
- FR-08-AC7: Local storage paths (`uploads/`, `downloads/`) are configurable via the settings form (stored in `settings` table).

---

## 2. Non-Functional Requirements

| ID | Requirement | Specification |
|----|-------------|---------------|
| NFR-01 | **Backend Port** | Express server listens on port `3001`. |
| NFR-02 | **Frontend Dev Port** | Vite dev server runs on port `5173` with proxy to `http://localhost:3001`. |
| NFR-03 | **SQLite WAL Mode** | `better-sqlite3` database opened with `PRAGMA journal_mode=WAL;`. |
| NFR-04 | **Backend Proxy Timeout** | HTTP client for RH API calls has a timeout of 120 seconds. |
| NFR-05 | **Polling Interval** | Frontend polls `GET /api/tasks/:id` every 5 seconds (5000ms). |
| NFR-06 | **Timestamp Format** | All dates and timestamps in API responses use ISO 8601 format (`YYYY-MM-DDTHH:mm:ss.sssZ`). |
| NFR-07 | **API Key Security** | The RH API key is stored in the local SQLite database, never exposed to the frontend. Frontend only sees `keyIsSet: boolean`. |
| NFR-08 | **File Upload Limit** | Backend `multer` middleware limits uploads to 50MB per file. |
| NFR-09 | **Responsive UI** | All frontend pages are responsive down to 1024px width. |

---

## 3. Data Specifications

### Table: `tools`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Internal unique ID |
| `webappId` | `TEXT` | `NOT NULL UNIQUE` | RH webapp UUID |
| `webappName` | `TEXT` | `NOT NULL` | Human-readable app name from RH |
| `nodeInfoList` | `TEXT` | `NOT NULL` | JSON-serialized array of field definitions |
| `tags` | `TEXT` | `DEFAULT '[]'` | JSON-serialized array of tag strings |
| `createdAt` | `TEXT` | `NOT NULL` | ISO 8601 timestamp |
| `updatedAt` | `TEXT` | `NOT NULL` | ISO 8601 timestamp |

**Indexes**: `idx_tools_webappId ON tools(webappId)`, `idx_tools_updatedAt ON tools(updatedAt DESC)`

---

### Table: `tasks`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Internal unique ID |
| `taskId` | `TEXT` | `NOT NULL` | RH task UUID (from run API response) |
| `toolId` | `INTEGER` | `NOT NULL REFERENCES tools(id) ON DELETE CASCADE` | FK to tools table |
| `status` | `TEXT` | `NOT NULL DEFAULT 'PENDING'` | One of: `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `EXPIRED` |
| `nodeInfoList` | `TEXT` | `NOT NULL` | JSON-serialized payload used for execution |
| `resultFiles` | `TEXT` | `DEFAULT '[]'` | JSON-serialized array of `{ nodeId, filePath, fileName, mimeType }` |
| `errorMessage` | `TEXT` | `NULL` | Human-readable error text |
| `failedReason` | `TEXT` | `NULL` | RH API error code/reason |
| `pollCount` | `INTEGER` | `DEFAULT 0` | Number of polls performed |
| `lastPolledAt` | `TEXT` | `NULL` | ISO 8601 of last poll |
| `createdAt` | `TEXT` | `NOT NULL` | ISO 8601 timestamp |
| `updatedAt` | `TEXT` | `NOT NULL` | ISO 8601 timestamp |
| `completedAt` | `TEXT` | `NULL` | ISO 8601 of terminal state |

**Indexes**: `idx_tasks_taskId ON tasks(taskId)`, `idx_tasks_toolId ON tasks(toolId)`, `idx_tasks_status ON tasks(status)`, `idx_tasks_createdAt ON tasks(createdAt DESC)`

---

### Table: `settings`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `key` | `TEXT` | `PRIMARY KEY` | Setting name (e.g., `rh_api_key`, `uploads_path`, `downloads_path`) |
| `value` | `TEXT` | `NOT NULL` | Setting value |

**Notes**:
- `rh_api_key` stores the encrypted or plaintext RH API key (plaintext sufficient for local desktop use).
- `uploads_path` defaults to `./uploads`.
- `downloads_path` defaults to `./downloads`.

---

## 4. API Specifications

### 4.1 `POST /api/settings/key`

Set or update the RH API key.

**Request**:
```json
{
  "apiKey": "sk-...rest-of-key"
}
```

**Success Response** `200`:
```json
{
  "keyIsSet": true
}
```

**Error Response** `400` (invalid key):
```json
{
  "error": "Invalid API key",
  "keyIsSet": false
}
```

**Behavior**:
1. Upsert `rh_api_key` in `settings` table.
2. Make a test RH API call (GET a known webapp schema or health endpoint).
3. If test succeeds → return `200`.
4. If test fails → delete the key from settings, return `400`.

---

### 4.2 `GET /api/settings/key/status`

Check if API key is configured.

**Response** `200`:
```json
{
  "keyIsSet": true
}
```

**Behavior**: Queries `settings` table for `rh_api_key`. Returns `true` if value is non-empty.

---

### 4.3 `POST /api/tools/register`

Register a tool by webappId.

**Request**:
```json
{
  "webappId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Success Response** `201`:
```json
{
  "tool": {
    "id": 1,
    "webappId": "550e8400-e29b-41d4-a716-446655440000",
    "webappName": "Face Swap Pro",
    "nodeInfoList": [ ... ],
    "tags": ["face", "swap", "image"],
    "createdAt": "2026-05-24T10:00:00.000Z",
    "updatedAt": "2026-05-24T10:00:00.000Z"
  }
}
```

**Error Responses**:
- `400` — Missing or invalid `webappId`
- `400` — RH API schema fetch failed or returned no `nodeInfoList`
- `400` — No API key configured (keyIsSet is false)
- `500` — Database error

---

### 4.4 `GET /api/tools`

List all registered tools.

**Response** `200`:
```json
{
  "tools": [
    {
      "id": 1,
      "webappId": "550e8400-e29b-41d4-a716-446655440000",
      "webappName": "Face Swap Pro",
      "tags": ["face", "swap", "image"],
      "createdAt": "2026-05-24T10:00:00.000Z",
      "updatedAt": "2026-05-24T12:00:00.000Z",
      "taskCount": 5
    }
  ]
}
```

---

### 4.5 `DELETE /api/tools/:id`

Delete a tool and its associated tasks.

**Response** `200`:
```json
{
  "success": true
}
```

**Error** `404`: Tool not found.

---

### 4.6 `POST /api/tasks/run`

Execute a tool with field values.

**Request**:
```json
{
  "toolId": 1,
  "fieldValues": {
    "node_1": "https://example.com/image.jpg",
    "node_2": 42,
    "node_3": "option_b"
  }
}
```

**Success Response** `201`:
```json
{
  "task": {
    "id": 10,
    "taskId": "rh-task-uuid",
    "toolId": 1,
    "status": "PENDING",
    "createdAt": "2026-05-24T12:00:00.000Z"
  }
}
```

**Behavior**:
1. Resolve tool by `toolId`.
2. For file-type fields, upload via RH upload API, replace value with returned `fileName`.
3. Build `nodeInfoList` payload with updated values.
4. Call RH run API.
5. Create task record with `status: PENDING` and full `nodeInfoList` payload.
6. Return task.

---

### 4.7 `GET /api/tasks`

List task history.

**Response** `200`:
```json
{
  "tasks": [
    {
      "id": 10,
      "taskId": "rh-task-uuid",
      "toolId": 1,
      "toolName": "Face Swap Pro",
      "status": "COMPLETED",
      "resultCount": 2,
      "createdAt": "2026-05-24T12:00:00.000Z",
      "completedAt": "2026-05-24T12:05:00.000Z"
    }
  ]
}
```

**Query Parameters**:
- `?search=face` — filter by tool name (LIKE match)
- `?status=COMPLETED` — filter by status

---

### 4.8 `GET /api/tasks/:id`

Get full task detail.

**Response** `200`:
```json
{
  "task": {
    "id": 10,
    "taskId": "rh-task-uuid",
    "toolId": 1,
    "toolName": "Face Swap Pro",
    "status": "COMPLETED",
    "nodeInfoList": [ ... ],
    "resultFiles": [
      { "nodeId": "output_1", "filePath": "/downloads/task_10/result.png", "fileName": "result.png", "mimeType": "image/png" }
    ],
    "errorMessage": null,
    "failedReason": null,
    "pollCount": 60,
    "createdAt": "2026-05-24T12:00:00.000Z",
    "updatedAt": "2026-05-24T12:05:00.000Z",
    "completedAt": "2026-05-24T12:05:00.000Z"
  }
}
```

**Error** `404`: Task not found.

---

### 4.9 `POST /api/upload`

Upload a file.

**Request**: `multipart/form-data` with field `file`.

**Success Response** `200`:
```json
{
  "fileName": "rh-uploaded-filename.jpg"
}
```

**Error** `413`: File too large (>50MB).

---

### 4.10 `GET /api/download/:taskId/:nodeId`

Download a result file.

**Response**: Streams the file with appropriate `Content-Type` and `Content-Disposition: attachment; filename="..."`.

**Error** `404`: File not found.

---

## 5. Frontend Route Specifications

| Route | Page | Description |
|-------|------|-------------|
| `/` | **Catalog** | Lists all registered tools (FR-02). Cards with name, tags, stats. Search bar and tag filter. Delete button per tool. Click navigates to runner. |
| `/register` | **Register Tool** | Form with single input for `webappId`. On submit, calls POST /api/tools/register. Redirects to Catalog on success. Shows error inline on failure. |
| `/tools/:id/run` | **Tool Runner** | Dynamic form rendered from tool's `nodeInfoList` (FR-03). "Run" button submits (FR-04). Redirects to `/history/:newTaskId` on execution. |
| `/history` | **Task History** | Paginated list of all tasks (FR-06). Search/filter by name or status. Click navigates to detail. |
| `/history/:id` | **Task Detail** | Full task info, status display with real-time polling (FR-05). Once terminal, shows result download links. Delete button. |
| `/settings` | **Settings** | API key form (FR-07). Shows keyIsSet status. Optional upload/download path configuration. |

### Navigation

- Persistent top navigation bar with links: Catalog, Register, History, Settings.
- Active route highlighted.
- KeyIsSet indicator in nav bar (green dot when configured, red when not).

---

## 6. Monorepo Structure

```
rh-studio/
├── package.json            # Root: concurrently runs client + server
├── tsconfig.base.json      # Shared tsconfig with path aliases
├── client/
│   ├── package.json
│   ├── vite.config.ts      # Proxy /api/* to localhost:3001
│   ├── tsconfig.json       # Extends ../tsconfig.base.json
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx          # Router setup
│       ├── api/             # HTTP client functions
│       ├── components/      # Shared UI components
│       │   ├── Layout.tsx
│       │   ├── DynamicField.tsx  # FR-03: fieldType switch
│       │   ├── StatusBadge.tsx   # FR-05: status indicator
│       │   └── ConfirmDialog.tsx # Shared confirmation modal
│       ├── pages/
│       │   ├── Catalog.tsx
│       │   ├── RegisterTool.tsx
│       │   ├── ToolRunner.tsx
│       │   ├── TaskHistory.tsx
│       │   ├── TaskDetail.tsx
│       │   └── Settings.tsx
│       └── types/           # Shared types
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts         # Express server entry
│       ├── db/
│       │   ├── connection.ts # SQLite init + WAL mode
│       │   └── migrations.ts # Schema creation
│       ├── routes/
│       │   ├── tools.ts
│       │   ├── tasks.ts
│       │   ├── settings.ts
│       │   └── upload.ts
│       ├── services/
│       │   └── rhClient.ts  # RH API HTTP client
│       └── types/           # Shared types (mirrored from shared/)
└── shared/
    └── types.ts             # Tool, Task, FieldDefinition interfaces
```

---

## 7. Dependencies

### Root
- `concurrently` — run client + server in parallel

### Client
- `react`, `react-dom` — UI framework
- `react-router-dom` — client-side routing
- `vite`, `@vitejs/plugin-react` — dev server and bundler
- `typescript` — type checking

### Server
- `express` — HTTP server
- `better-sqlite3` — SQLite driver (synchronous, WAL-compatible)
- `multer` — multipart file upload handling
- `tsx` — TypeScript execution for dev mode
- `typescript` — type checking
- `@types/express`, `@types/better-sqlite3`, `@types/multer` — type definitions

---

## 8. Scenarios

### Happy Path: Register → Run → Complete

1. User sets API key in Settings (FR-07).
2. User navigates to `/register`, enters a valid `webappId` (FR-01).
3. Tool appears in Catalog (FR-02).
4. User clicks tool → `/tools/:id/run` → dynamic form renders (FR-03).
5. User fills fields (uploads an image via file input), clicks Run (FR-04).
6. System creates task, redirects to `/history/:id` (FR-05).
7. Status shows PENDING → RUNNING → COMPLETED (polling every 5s).
8. User sees result download links (FR-05, FR-08).

### Error Path: Invalid API Key

1. User enters an invalid key in Settings.
2. Backend validates, returns `400 { error: "Invalid API key" }`.
3. Key is not saved. Frontend shows error. `keyIsSet` remains `false`.

### Error Path: RH API Fails During Register

1. User enters a valid-looking `webappId` that doesn't exist on RH.
2. Backend calls RH API, gets 404.
3. Backend returns `400 { error: "Invalid webappId or schema fetch failed" }`.
4. Frontend shows inline error. Tool not created.

### Error Path: RH API Fails During Execution

1. User submits form, backend creates task with PENDING.
2. Polling detects FAILED status.
3. Backend captures `errorMessage` and `failedReason`.
4. Frontend shows red FAILED badge with error details.

---

## 9. Expiry Logic

- On every poll, backend checks if `task.createdAt` is more than 25 hours ago.
- If yes and status is `PENDING` or `RUNNING`, set status to `EXPIRED` and stop polling.
- `EXPIRED` is a terminal state — no further polling.

---

## 10. Open Questions

None resolved — all decisions deferred to Design phase.

---

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-05-24 | Initial specification from proposal | SDD Spec |
