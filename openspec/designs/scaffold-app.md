# SDD Design: Scaffold App — RH Studio Foundation

| Field | Value |
|-------|-------|
| **Change ID** | scaffold-app |
| **Status** | Designed |
| **Spec** | `openspec/specs/scaffold-app.md` |
| **Proposal** | `openspec/proposals/scaffold-app.md` |

---

## 1. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser (localhost:5173)                    │
│                                                                     │
│  ┌──────────┐  ┌───────────┐  ┌────────────┐  ┌───────────────┐  │
│  │ Catalog  │  │Register   │  │ ToolRunner │  │ TaskDetail    │  │
│  │ (/)      │  │(/register)│  │(/tools/:id)│  │ (/history/:id)│  │
│  └────┬─────┘  └─────┬─────┘  └─────┬──────┘  └───────┬───────┘  │
│       │              │              │ polling(5s)     │          │
│       └──────────────┴──────────────┴─────────────────┴──────────┘  │
│                                  │                                  │
│                           fetch /api/*                              │
│                                  │                                  │
└──────────────────────────────────┼──────────────────────────────────┘
                                   │
                    Vite Dev Proxy (vite.config.ts)
                    /api/* → http://localhost:3001
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   Express Server (localhost:3001)                    │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                     Middleware Stack                          │  │
│  │  cors() → json() → urlencoded() → multer() → apiKeyGuard    │  │
│  └──────────────────────┬───────────────────────────────────────┘  │
│                         │                                           │
│          ┌──────────────┼──────┬──────────────┬─────────────┐     │
│          ▼              ▼      ▼              ▼             ▼     │
│  ┌────────────┐ ┌──────────┐ ┌────────┐ ┌──────────┐ ┌─────────┐ │
│  │ /api/tools │ │/api/tasks│ │/api/   │ │/api/     │ │/api/    │ │
│  │  routes    │ │  routes  │ │settings│ │  upload  │ │download │ │
│  └─────┬──────┘ └────┬─────┘ └───┬────┘ └────┬─────┘ └────┬────┘ │
│        │              │           │           │            │       │
│        └──────────────┴───────────┴───────────┴────────────┘       │
│                        │                                            │
│                        ▼                                            │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                   rhClient.ts                              │    │
│  │                                                           │    │
│  │  fetchSchema(webappId)  → GET /api/webapp/apiCallDemo     │    │
│  │  runTask(webappId, nodeInfoList) → POST run/ai-app/{id}   │    │
│  │  queryTask(taskId)      → POST /openapi/v2/query         │    │
│  │  uploadFile(file, fileName) → POST /openapi/v2/upload    │    │
│  │  downloadResult(url)    → GET <rh-result-url>            │    │
│  └────────────────────────────────────────────────────────────┘    │
│                        │                                            │
│                        ▼                                            │
│  ┌──────────────────────────────────────────┐                      │
│  │          SQLite (better-sqlite3, WAL)     │                      │
│  │                                          │                      │
│  │  tables: tools, tasks, settings          │                      │
│  │  file:   ./data/rh-studio.db             │                      │
│  └──────────────────────────────────────────┘                      │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
                      ┌─────────────────────┐
                      │  RunningHub API      │
                      │  (api.runninghub.ai) │
                      └─────────────────────┘
```

### File Upload Flow

```
┌──────────┐  multipart/form-data   ┌──────────┐  POST /openapi/v2/upload  ┌──────────┐
│ Frontend │ ──────────────────────▶│  Server  │ ──────────────────────────▶│  RH API  │
│  (File)  │                        │ (multer) │                             │          │
│          │◄──────────────────────│          │◄────────────────────────────│          │
└──────────┘   { fileName: "..." } └──────────┘   { fileName: "..." }      └──────────┘
```

### Polling Flow

```
┌──────────┐  GET /api/tasks/:id (every 5s)  ┌──────────┐  POST /openapi/v2/query  ┌──────────┐
│ Frontend │ ◄────poll timer───────          │  Server  │ ──────────────────────────▶│  RH API  │
│          │                                  │          │                            │          │
│  stops   │◄──── terminal status ───────────│          │◄────────────────────────────│          │
│  polling │                                  │          │  { status, resultUrls }     │          │
└──────────┘                                  └──────────┘                            └──────────┘
```

---

## 2. Component Tree (Frontend)

```
<App>
  <BrowserRouter>
    <Routes>
      <Route element={<Layout />}>
        │
        │  Layout structure:
        │  <div className="app-layout">
        │    <nav className="top-nav">
        │      <NavLink to="/">Catalog</NavLink>
        │      <NavLink to="/register">Register</NavLink>
        │      <NavLink to="/history">History</NavLink>
        │      <NavLink to="/settings">Settings</NavLink>
        │      <KeyIsSetIndicator />    {/* green dot / red dot */}
        │    </nav>
        │    <main><Outlet /></main>
        │  </div>
        │
        <Route index element={<Catalog />} />
        │  ├── SearchBar (debounced 300ms input)
        │  ├── TagFilter (multi-select dropdown from unique tags)
        │  └── ToolCard[] (name, webappId truncated, tags, dates, delete button)
        │       └── ConfirmDialog (on delete click)
        │
        <Route path="register" element={<RegisterTool />} />
        │  └── Form (webappId UUID input + submit)
        │       └── inline validation error
        │
        <Route path="tools/:id/run" element={<ToolRunner />} />
        │  ├── Tool header (webappName, webappId)
        │  └── Form
        │       └── DynamicField[] (one per nodeInfoList entry)
        │            ├── FileUploader    (IMAGE | AUDIO | VIDEO | FILE)
        │            │    └── file input + preview/player
        │            ├── TextInput      (STRING)
        │            │    └── <input> or <textarea> based on fieldData.multiline
        │            ├── Dropdown       (LIST)
        │            │    └── <select> with options from fieldData JSON parse
        │            ├── Switch         (SWITCH)
        │            │    └── <input type="checkbox"> or toggle
        │            ├── LoraSelector   (LORA)
        │            │    └── text input + optional autocomplete
        │            └── NumberInput    (INT)
        │                 └── <input type="number"> with min/max
        │
        <Route path="history" element={<TaskHistory />} />
        │  ├── SearchBar (tool name, status)
        │  └── TaskRow[]
        │       └── toolName, status badge, dates, result count
        │
        <Route path="history/:id" element={<TaskDetail />} />
        │  ├── Task metadata (id, taskId, dates)
        │  ├── StatusBadge (color + label per status):
        │  │    PENDING  → pulsing yellow dot + "Queued"
        │  │    RUNNING  → spinning icon   + "Running"
        │  │    COMPLETED→ green checkmark + "Completed"
        │  │    FAILED   → red X           + "Failed"
        │  │    EXPIRED  → gray icon       + "Expired"
        │  ├── Error details (if FAILED — errorMessage, failedReason)
        │  ├── Result download links (if COMPLETED — one per resultFile)
        │  └── Delete button + ConfirmDialog
        │
        <Route path="settings" element={<Settings />} />
           └── Form (API key input, type="password", submit + validate)
                keyIsSet indicator
                optional: uploadsPath, downloadsPath inputs
```

---

## 3. Server Architecture

### Express App Structure

```
server/src/
├── index.ts              # Entry point: init DB, register middleware, mount routes, listen :3001
├── db/
│   ├── connection.ts     # Create/open SQLite file, enable WAL, export db instance
│   └── migrations.ts     # Run CREATE TABLE IF NOT EXISTS for tools, tasks, settings
├── routes/
│   ├── tools.ts          # GET /api/tools, POST /api/tools/register, DELETE /api/tools/:id
│   ├── tasks.ts          # GET /api/tasks, GET /api/tasks/:id, POST /api/tasks/run, DELETE /api/tasks/:id
│   ├── settings.ts       # GET /api/settings/key/status, POST /api/settings/key
│   └── upload.ts         # POST /api/upload, GET /api/download/:taskId/:nodeId
├── services/
│   └── rhClient.ts       # Class wrapping all RH HTTP calls
└── types/
    └── index.ts          # Re-export shared types, add server-only types
```

### Middleware Stack

```typescript
// order in index.ts:
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// API key guard — applied to all /api/* routes except /api/settings/key and /api/settings/key/status
// Reads from settings table, returns 400 if key is empty
app.use('/api', apiKeyGuard)

// Error handler — must be registered LAST
app.use(errorHandler)
```

**apiKeyGuard** middleware:

```typescript
function apiKeyGuard(req: Request, res: Response, next: NextFunction) {
  if (req.path === '/api/settings/key' || req.path === '/api/settings/key/status') {
    return next()
  }
  const key = getSetting('rh_api_key')
  if (!key) {
    return res.status(400).json({ error: 'API key not configured' })
  }
  next()
}
```

### RH Client

```typescript
class RhClient {
  private baseUrl = 'https://api.runninghub.ai'
  private apiKey: string
  private timeout = 120_000 // ms (NFR-04)

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  // GET /api/webapp/apiCallDemo?webappId={webappId}
  // Returns: { code: number, msg: string, data: { nodeInfoList: NodeInfo[], ... } }
  async fetchSchema(webappId: string): Promise<RhSchemaResponse>

  // POST /openapi/v2/run/ai-app/{webappId}
  // Body: { nodeInfoList: NodeInfo[] }
  // Returns: { code: number, msg: string, data: { taskId: string } }
  async runTask(webappId: string, nodeInfoList: NodeInfo[]): Promise<RhRunResponse>

  // POST /openapi/v2/query
  // Body: { taskId: string }
  // Returns: { code: number, msg: string, data: { status: string, resultUrls: any, failedReason?: string, errorMessage?: string } }
  async queryTask(taskId: string): Promise<RhQueryResponse>

  // POST /openapi/v2/upload
  // Multipart: file + fileName
  // Returns: { code: number, msg: string, data: { fileName: string } }
  async uploadFile(file: Buffer, originalName: string): Promise<RhUploadResponse>

  // GET <resultUrl>
  // Returns: file stream (Buffer)
  async downloadResult(url: string): Promise<Buffer>

  // Helper: check if API key is valid by calling fetchSchema with a known webappId
  async validateKey(): Promise<boolean>
}
```

### Polling Architecture

On-demand polling (pessimistic):

```
Frontend polls GET /api/tasks/:id every 5 seconds
  → Server reads task from SQLite
  → If task.status is PENDING or RUNNING:
      → Server calls rhClient.queryTask(taskId)
      → Server updates task record (status, pollCount, lastPolledAt)
      → If COMPLETED: server downloads results via rhClient.downloadResult(), saves to downloads/
      → If FAILED: captures errorMessage/failedReason
      → If createdAt + 25h < now: sets EXPIRED
  → Returns full task object to frontend
  → Frontend stops polling on terminal status (COMPLETED | FAILED | EXPIRED)
```

---

## 4. State Management

No external state library. React-only state via custom hooks:

```typescript
// hooks/useTools.ts
// State: { tools: Tool[], loading: boolean, error: string | null }
// Exposes: fetchTools(), registerTool(webappId), deleteTool(id)
// Calls: GET /api/tools, POST /api/tools/register, DELETE /api/tools/:id

// hooks/useTasks.ts
// State: { tasks: Task[], loading: boolean, error: string | null }
// Exposes: fetchTasks(), fetchTask(id), runTask(toolId, fieldValues), deleteTask(id)
// Calls: GET /api/tasks, GET /api/tasks/:id, POST /api/tasks/run, DELETE /api/tasks/:id

// hooks/useSettings.ts
// State: { keyIsSet: boolean, loading: boolean, error: string | null }
// Exposes: checkKeyStatus(), setApiKey(apiKey)
// Calls: GET /api/settings/key/status, POST /api/settings/key

// hooks/usePolling.ts
// Input: taskId (number | null)
// Behavior: polls GET /api/tasks/:id every 5000ms while taskId is not null
//  - Returns { task: Task | null, loading: boolean, error: string | null }
//  - Stops polling when task.status is COMPLETED | FAILED | EXPIRED
//  - Stops polling on unmount (cleanup via clearInterval in useEffect return)
//  - Does NOT poll if taskId is null

function usePolling(taskId: number | null) {
  const [task, setTask] = useState<Task | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (taskId === null) return

    const poll = async () => {
      try {
        const res = await fetch(`/api/tasks/${taskId}`)
        const data = await res.json()
        setTask(data.task)
        setError(null)

        const terminal = ['COMPLETED', 'FAILED', 'EXPIRED']
        if (terminal.includes(data.task.status)) {
          clearInterval(intervalId)
        }
      } catch (err) {
        setError('Polling failed')
      }
    }

    poll() // immediate first call
    const intervalId = setInterval(poll, 5000)

    return () => clearInterval(intervalId)
  }, [taskId])

  return { task, error }
}
```

---

## 5. Data Flow Diagrams

### 5.1 Tool Registration

```
RegisterTool page
  │
  ├── User enters webappId (UUID)
  │
  ├── Client-side validation: UUID format check (/^[0-9a-f]{8}-...$/i)
  │
  ├── POST /api/tools/register { webappId }
  │     │
  │     ├── Server: apiKeyGuard middleware passes (key exists)
  │     │
  │     ├── Server: rhClient.fetchSchema(webappId)
  │     │     └── GET https://api.runninghub.ai/api/webapp/apiCallDemo?webappId=...
  │     │
  │     ├── Server: if response.code !== 0 || !data.nodeInfoList
  │     │     └── return 400 { error: "Invalid webappId or schema fetch failed" }
  │     │
  │     ├── Server: parse nodeInfoList, extract webappName from data
  │     │
  │     ├── Server: INSERT OR REPLACE INTO tools (webappId, webappName, nodeInfoList, tags, createdAt, updatedAt)
  │     │
  │     └── return 201 { tool: { id, webappId, webappName, nodeInfoList, tags, createdAt, updatedAt } }
  │
  └── Frontend: navigate('/')
```

### 5.2 Tool Execution

```
ToolRunner page
  │
  ├── User fills dynamic form, clicks "Run"
  │
  ├── Client-side validation (required fields, INT bounds, file size)
  │
  ├── Prepare fieldValues:
  │   For each field in nodeInfoList:
  │     if fieldType in [IMAGE, AUDIO, VIDEO, FILE] AND value is a new File:
  │       │
  │       ├── POST /api/upload (multipart/form-data with file)
  │       │     │
  │       │     ├── Server: multer receives file (max 50MB)
  │       │     ├── Server: rhClient.uploadFile(file, originalName)
  │       │     │     └── POST https://api.runninghub.ai/openapi/v2/upload
  │       │     └── return { fileName: "rh-uuid-filename.jpg" }
  │       │
  │       └── fieldValue = fileName (from RH response)
  │
  ├── POST /api/tasks/run { toolId, fieldValues: { nodeId: value } }
  │     │
  │     ├── Server: lookup tool by toolId
  │     ├── Server: build nodeInfoList payload (map each nodeId → updated fieldValue)
  │     ├── Server: rhClient.runTask(webappId, nodeInfoList)
  │     │     └── POST https://api.runninghub.ai/openapi/v2/run/ai-app/{webappId}
  │     ├── Server: INSERT INTO tasks (taskId, toolId, status, nodeInfoList, createdAt, updatedAt)
  │     └── return 201 { task: { id, taskId, toolId, status: "PENDING", createdAt } }
  │
  └── Frontend: navigate(`/history/${newTaskId}`)
```

### 5.3 Polling

```
TaskDetail page
  │
  ├── usePolling(taskId) starts on mount
  │
  ├── [every 5000ms] GET /api/tasks/:id
  │     │
  │     ├── Server: read task from SQLite by :id
  │     │
  │     ├── if task.status is PENDING or RUNNING:
  │     │   ├── Check expiry: if createdAt + 25h < now → set EXPIRED, stop
  │     │   │
  │     │   ├── rhClient.queryTask(taskId)
  │     │   │     └── POST https://api.runninghub.ai/openapi/v2/query { taskId }
  │     │   │
  │     │   ├── Map RH status to our status (e.g., "processing" → RUNNING, "succeed" → COMPLETED)
  │     │   │
  │     │   ├── if COMPLETED:
  │     │   │     ├── For each resultUrl: rhClient.downloadResult(url)
  │     │   │     ├── Save file to ./downloads/{taskId}/{nodeId}_{filename}
  │     │   │     ├── Build resultFiles array
  │     │   │     └── UPDATE tasks SET status='COMPLETED', resultFiles, completedAt, ...
  │     │   │
  │     │   ├── if FAILED:
  │     │   │     └── UPDATE tasks SET status='FAILED', errorMessage, failedReason, ...
  │     │   │
  │     │   └── UPDATE tasks SET pollCount++, lastPolledAt, updatedAt
  │     │
  │     └── return 200 { task: { ...full task object } }
  │
  ├── Frontend renders StatusBadge based on task.status
  │
  └── When status is terminal (COMPLETED | FAILED | EXPIRED):
      ├── usePolling stops (clears interval)
      └── Show results or error
```

### 5.4 File Upload

```
User selects file in DynamicField (IMAGE/AUDIO/VIDEO/FILE)
  │
  ├── Frontend stores File object in local state (no upload yet)
  │
  ├── On form submit ("Run"):
  │   ├── Create FormData with the File
  │   └── POST /api/upload (body: multipart with file field)
  │         │
  │         ├── Server: multer.single('file') middleware
  │         ├── Server: validate mime type against fieldType:
  │         │     IMAGE → image/jpeg, image/png, image/webp, image/gif
  │         │     AUDIO → audio/mpeg, audio/wav, audio/ogg, audio/mp4
  │         │     VIDEO → video/mp4, video/webm, video/quicktime
  │         │     FILE → any
  │         ├── Server: rhClient.uploadFile(req.file.buffer, req.file.originalname)
  │         │     └── POST https://api.runninghub.ai/openapi/v2/upload
  │         │         (multipart: file buffer + original filename)
  │         └── return { fileName: "rh-returned-filename" }
  │
  └── Frontend sets fieldValue = fileName for the RH run payload
```

### 5.5 File Download

```
User clicks download link on TaskDetail (COMPLETED)
  │
  ├── GET /api/download/:taskId/:nodeId
  │     │
  │     ├── Server: lookup task by :taskId
  │     ├── Server: find resultFile matching :nodeId in task.resultFiles
  │     ├── Server: read file from local downloads/ path
  │     │
  │     └── Stream file with:
  │         res.setHeader('Content-Type', resultFile.mimeType)
  │         res.setHeader('Content-Disposition', `attachment; filename="${resultFile.fileName}"`)
  │         fs.createReadStream(filePath).pipe(res)
  │
  └── Browser downloads the file
```

---

## 6. Key Implementation Details

### 6.1 DynamicField.tsx Field Type Switching

Use a `Map<FieldType, React.FC<FieldProps>>` registry:

```typescript
const FIELD_COMPONENTS: Map<FieldType, React.FC<FieldProps>> = new Map([
  ['IMAGE',     FileUploader],
  ['AUDIO',     FileUploader],
  ['VIDEO',     FileUploader],
  ['FILE',      FileUploader],
  ['STRING',    TextInput],
  ['LIST',      Dropdown],
  ['SWITCH',    Switch],
  ['LORA',      LoraSelector],
  ['INT',       NumberInput],
])

function DynamicField({ field, value, onChange, error }: DynamicFieldProps) {
  const Component = FIELD_COMPONENTS.get(field.fieldType as FieldType)

  if (!Component) {
    return <div className="field-error">Unsupported field type: {field.fieldType}</div>
  }

  return (
    <div className="dynamic-field">
      <label>
        {field.fieldName}
        {field.fieldData?.required && <span className="required">*</span>}
      </label>
      <Component
        field={field}
        value={value}
        onChange={(newValue) => onChange(field.nodeId, newValue)}
      />
      {field.fieldData?.description && (
        <p className="field-description">{field.fieldData.description}</p>
      )}
      {error && <p className="field-error-text">{error}</p>}
    </div>
  )
}
```

### 6.2 Parsing LIST Field Data

```typescript
// fieldData comes from RH API as a JSON string
// Example fieldData for a LIST field:
//   `[{"label": "Style A", "value": "style_a"}, {"label": "Style B", "value": "style_b"}]`

function parseListOptions(fieldData: string): { label: string; value: string }[] {
  try {
    const parsed = JSON.parse(fieldData)
    if (Array.isArray(parsed) && parsed.every(item => item.label && item.value !== undefined)) {
      return parsed
    }
    return []
  } catch {
    return []
  }
}
```

### 6.3 Building nodeInfoList for Execution

```typescript
// On POST /api/tasks/run:
async function buildNodeInfoList(tool: Tool, fieldValues: Record<string, any>): Promise<NodeInfo[]> {
  const nodeInfoList: NodeInfo[] = []

  for (const node of tool.nodeInfoList) {
    let value = fieldValues[node.nodeId] ?? node.fieldValue ?? ''

    // If file type and value is a fileName (already uploaded), use as-is
    // If file was uploaded, value is already the RH fileName from upload step

    nodeInfoList.push({
      nodeId: node.nodeId,
      nodeName: node.nodeName ?? node.fieldName,
      nodeType: node.nodeType,
      fieldType: node.fieldType,
      fieldValue: String(value),
      fieldName: node.fieldName,
      fieldData: node.fieldData,
    })
  }

  return nodeInfoList
}
```

### 6.4 Polling Implementation Details

```typescript
// On each poll request in GET /api/tasks/:id route handler:

function handleTaskPoll(req, res) {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id)

  if (!task) return res.status(404).json({ error: 'Task not found' })

  if (task.status === 'PENDING' || task.status === 'RUNNING') {
    // Check expiry (25 hours)
    const createdAt = new Date(task.createdAt).getTime()
    if (Date.now() - createdAt > 25 * 60 * 60 * 1000) {
      db.prepare('UPDATE tasks SET status = ?, updatedAt = ? WHERE id = ?')
        .run('EXPIRED', new Date().toISOString(), task.id)
      task.status = 'EXPIRED'
      return res.json({ task: enrichTask(task) })
    }

    try {
      const rhResult = await rhClient.queryTask(task.taskId)

      // Map RH status codes (adjust based on actual RH response shape)
      const statusMap: Record<string, string> = {
        'processing': 'RUNNING',
        'succeed': 'COMPLETED',
        'failed': 'FAILED',
      }

      const newStatus = statusMap[rhResult.data.status] || task.status

      // Handle terminal states
      if (newStatus === 'COMPLETED') {
        // Download all result files
        const resultFiles = await downloadResultFiles(task.id, rhResult.data.resultUrls)
        db.prepare(`UPDATE tasks SET status=?, resultFiles=?, completedAt=?, updatedAt=? WHERE id=?`)
          .run('COMPLETED', JSON.stringify(resultFiles), new Date().toISOString(), new Date().toISOString(), task.id)
      } else if (newStatus === 'FAILED') {
        db.prepare(`UPDATE tasks SET status=?, errorMessage=?, failedReason=?, updatedAt=? WHERE id=?`)
          .run('FAILED', rhResult.data.errorMessage, rhResult.data.failedReason, new Date().toISOString(), task.id)
      } else {
        db.prepare(`UPDATE tasks SET status=?, pollCount=pollCount+1, lastPolledAt=?, updatedAt=? WHERE id=?`)
          .run(newStatus, new Date().toISOString(), new Date().toISOString(), task.id)
      }
    } catch (err) {
      // Log error but don't fail the request — return current known status
      console.error(`Poll failed for task ${task.id}:`, err.message)
    }
  }

  res.json({ task: enrichTask(task) })
}
```

### 6.5 SQLite WAL Mode

```typescript
// db/connection.ts
import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.join(__dirname, '../../data/rh-studio.db')

const db = new Database(DB_PATH)

// Enable WAL mode for concurrent read performance
db.pragma('journal_mode = WAL')
// Enable foreign keys
db.pragma('foreign_keys = ON')

export default db
```

### 6.6 Type Mapping for nodeInfoList

The RH API returns `nodeInfoList` as an array of objects. Each node has these relevant fields:

```typescript
interface RhNodeInfo {
  nodeId: string
  nodeName: string
  nodeType: string
  fieldName: string
  fieldType: 'IMAGE' | 'AUDIO' | 'VIDEO' | 'FILE' | 'STRING' | 'LIST' | 'SWITCH' | 'LORA' | 'INT'
  fieldValue: string
  fieldData: string  // JSON string with additional config
}

// fieldData JSON structure (parsed):
interface FieldData {
  description?: string
  required?: boolean
  multiline?: boolean  // for STRING type
  min?: number         // for INT type
  max?: number         // for INT type
  options?: { label: string; value: string }[]  // for LIST type — alternatives: top-level array
}
```

---

## 7. Error Handling Strategy

### Backend

```typescript
// Centralized error handler middleware (registers LAST)
function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error(`[${req.method} ${req.path}]`, err)

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large. Maximum size is 50MB.' })
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` })
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' })
  }

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  })
}
```

**Error codes used across routes**:

| Route | HTTP Status | Error Message |
|-------|------------|---------------|
| POST /api/tools/register | 400 | `Invalid webappId` |
| POST /api/tools/register | 400 | `API key not configured` |
| POST /api/tools/register | 400 | `Invalid webappId or schema fetch failed` |
| DELETE /api/tools/:id | 404 | `Tool not found` |
| POST /api/tasks/run | 400 | `Tool not found` |
| POST /api/tasks/run | 400 | `Validation failed: ...` |
| GET /api/tasks/:id | 404 | `Task not found` |
| DELETE /api/tasks/:id | 404 | `Task not found` |
| POST /api/settings/key | 400 | `Invalid API key` |
| GET /api/download/:taskId/:nodeId | 404 | `File not found` |
| POST /api/upload | 413 | `File too large. Maximum size is 50MB.` |

### Frontend

```typescript
// Per-page error state
const [error, setError] = useState<string | null>(null)

// Inline validation errors
const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

// On API error: set error state, display inline or as toast
try {
  const res = await fetch('/api/tools/register', { method: 'POST', ... })
  if (!res.ok) {
    const data = await res.json()
    setError(data.error)
    return
  }
  // success
} catch (err) {
  setError('Network error — is the server running?')
}
```

### RH API Error Capture

When RH API returns an error, the server captures four pieces of information:

```typescript
// Response shape on RH errors:
// { code: number (non-zero), msg: string, data: { ... } }

interface RhError {
  rhErrorCode: number      // RH code field (e.g., 1001)
  rhErrorMessage: string   // RH msg field
  rhFailedReason: string   // RH data.failedReason if available
  httpStatus: number       // HTTP status from RH response
}

// These are stored in the tasks table:
// errorMessage → rhErrorMessage or rhFailedReason
// failedReason → JSON.stringify(RhError) for debugging
```

---

## 8. File Organization

All paths relative to `rh-studio/`.

### Root

| File | Description |
|------|-------------|
| `package.json` | Root package: scripts `dev` (concurrently), `build`, scripts to run `client/` + `server/` in parallel |
| `tsconfig.base.json` | Shared TypeScript config: strict mode, path aliases for `@shared/*`, `@server/*`, `@client/*` |

### Shared (`shared/`)

| File | Description |
|------|-------------|
| `shared/types.ts` | All shared interfaces: `Tool`, `Task`, `FieldDefinition`, `RhNodeInfo`, `FieldData`, `FieldType`, `TaskStatus`, `ResultFile` |

### Server (`server/`)

| File | Description |
|------|-------------|
| `server/package.json` | Server dependencies: express, better-sqlite3, tsx, multer, cors, types, typescript |
| `server/tsconfig.json` | Extends `../tsconfig.base.json`, outDir: `./dist` |
| `server/src/index.ts` | Entry: init DB (run migrations), create Express app, register middleware + routes, listen on `:3001` |
| `server/src/db/connection.ts` | Create/open `data/rh-studio.db` with `better-sqlite3`, enable WAL and foreign keys, export `db` instance |
| `server/src/db/migrations.ts` | `runMigrations()`: CREATE TABLE IF NOT EXISTS for `tools`, `tasks`, `settings` with all columns, indexes |
| `server/src/routes/tools.ts` | Express Router: `POST /register`, `GET /`, `DELETE /:id` — tool CRUD operations |
| `server/src/routes/tasks.ts` | Express Router: `POST /run`, `GET /`, `GET /:id`, `DELETE /:id` — task lifecycle |
| `server/src/routes/settings.ts` | Express Router: `GET /key/status`, `POST /key` — API key management |
| `server/src/routes/upload.ts` | Express Router: `POST /` (multer + RH upload), `GET /download/:taskId/:nodeId` |
| `server/src/services/rhClient.ts` | `RhClient` class: fetchSchema, runTask, queryTask, uploadFile, downloadResult, validateKey |
| `server/src/types/index.ts` | Re-export from `@shared/types`, add server-only types (express middleware types, RH response shapes) |

### Client (`client/`)

| File | Description |
|------|-------------|
| `client/package.json` | Client dependencies: react, react-dom, react-router-dom, vite, @vitejs/plugin-react, typescript |
| `client/tsconfig.json` | Extends `../tsconfig.base.json`, JSX: react-jsx |
| `client/vite.config.ts` | Vite config: React plugin, proxy `/api` to `http://localhost:3001` |
| `client/index.html` | HTML shell with `<div id="root">`, imports `src/main.tsx` |
| `client/src/main.tsx` | ReactDOM.createRoot, renders `<App />` |
| `client/src/App.tsx` | BrowserRouter + Routes setup with Layout wrapper |
| `client/src/api/index.ts` | HTTP helper functions: `apiGet<T>(path)`, `apiPost<T>(path, body)`, `apiDelete<T>(path)`, `apiUpload<T>(path, formData)` |
| `client/src/hooks/useTools.ts` | Custom hook wrapping tool API calls + state (tools[], loading, error) |
| `client/src/hooks/useTasks.ts` | Custom hook wrapping task API calls + state (tasks[], loading, error) |
| `client/src/hooks/useSettings.ts` | Custom hook wrapping settings API calls + state (keyIsSet, loading, error) |
| `client/src/hooks/usePolling.ts` | Custom hook: takes taskId, polls GET /api/tasks/:id every 5s, returns { task, error, loading } |
| `client/src/components/Layout.tsx` | Top nav bar (NavLink, KeyIsSetIndicator), `<Outlet />` for pages |
| `client/src/components/DynamicField.tsx` | Generic field renderer: switches on fieldType via FIELD_COMPONENTS Map |
| `client/src/components/DynamicField/FileUploader.tsx` | File input with preview/player for IMAGE/AUDIO/VIDEO/FILE types |
| `client/src/components/DynamicField/TextInput.tsx` | `<input>` or `<textarea>` for STRING type |
| `client/src/components/DynamicField/Dropdown.tsx` | `<select>` with parsed options for LIST type |
| `client/src/components/DynamicField/Switch.tsx` | `<input type="checkbox">` or toggle for SWITCH type |
| `client/src/components/DynamicField/LoraSelector.tsx` | Text input for LORA type |
| `client/src/components/DynamicField/NumberInput.tsx` | `<input type="number">` with min/max for INT type |
| `client/src/components/StatusBadge.tsx` | Visual status indicator (colored icon + label) for TaskStatus |
| `client/src/components/ConfirmDialog.tsx` | Reusable modal: "Are you sure?" with confirm/cancel |
| `client/src/pages/Catalog.tsx` | Tool grid: search bar, tag filter, tool cards with delete |
| `client/src/pages/RegisterTool.tsx` | Single-input form for webappId UUID |
| `client/src/pages/ToolRunner.tsx` | Dynamic form from nodeInfoList, "Run" button |
| `client/src/pages/TaskHistory.tsx` | Task list: search/filter by name or status |
| `client/src/pages/TaskDetail.tsx` | Full task view with polling, results, error, delete |
| `client/src/pages/Settings.tsx` | API key (password input) + optional path config |
| `client/src/types/index.ts` | Re-export from `@shared/types`, add client-only types (component prop types, etc.) |

### Data Directory

| File | Description |
|------|-------------|
| `data/rh-studio.db` | SQLite database file (auto-created, not committed) |

---

## 9. Build & Dev Configuration

### Root package.json scripts

```json
{
  "scripts": {
    "dev": "concurrently -n client,server -c cyan,green \"npm run dev -w client\" \"npm run dev -w server\"",
    "build": "npm run build -w server && npm run build -w client",
    "start": "npm run start -w server"
  }
}
```

### Vite Proxy Config (`vite.config.ts`)

```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
```

### Server tsconfig (`server/tsconfig.json`)

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "ESNext",
    "moduleResolution": "bundler"
  },
  "include": ["src/**/*"]
}
```

---

## 10. Migration Script

```typescript
// server/src/db/migrations.ts
export function runMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      webappId TEXT NOT NULL UNIQUE,
      webappName TEXT NOT NULL,
      nodeInfoList TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tools_webappId ON tools(webappId);
    CREATE INDEX IF NOT EXISTS idx_tools_updatedAt ON tools(updatedAt DESC);

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      taskId TEXT NOT NULL,
      toolId INTEGER NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'PENDING',
      nodeInfoList TEXT NOT NULL,
      resultFiles TEXT NOT NULL DEFAULT '[]',
      errorMessage TEXT,
      failedReason TEXT,
      pollCount INTEGER NOT NULL DEFAULT 0,
      lastPolledAt TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      completedAt TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_taskId ON tasks(taskId);
    CREATE INDEX IF NOT EXISTS idx_tasks_toolId ON tasks(toolId);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_createdAt ON tasks(createdAt DESC);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)
}
```

---

## 11. Vite Config Proxy Details

The Vite proxy at `client/vite.config.ts` handles the `/api` prefix rewrite. For development, requests to `/api/*` from the SPA are automatically forwarded to `http://localhost:3001`. This means all `fetch('/api/tools')` calls in the frontend work transparently without CORS issues in dev mode.

In production (if/when built), the Express server would need to serve the built SPA assets as static files or CORS must be configured for a separate deployment.

---

## 12. Expiry Logic — Implementation Detail

```typescript
const TWENTY_FIVE_HOURS_MS = 25 * 60 * 60 * 1000

function isExpired(task: Task): boolean {
  if (task.status !== 'PENDING' && task.status !== 'RUNNING') return false
  return Date.now() - new Date(task.createdAt).getTime() > TWENTY_FIVE_HOURS_MS
}
```

Applied on every poll request (GET /api/tasks/:id). If expired, the server updates status to `EXPIRED` and returns the updated task. No further polling occurs because `EXPIRED` is a terminal status.

---

## 13. Security Considerations

- **API key**: stored in SQLite `settings` table, never returned to frontend. Frontend only sees `keyIsSet: boolean`.
- **File uploads**: validated by MIME type against expected fieldType on the server. Max 50MB enforced by multer.
- **Path traversal**: download endpoint validates that `:taskId` and `:nodeId` do not contain `../` or other path traversal sequences. Result file paths are constructed from the database, not from user input.
- **SQL injection**: prevented by better-sqlite3's parameterized queries (using `?` placeholders).

---

## 14. Open Questions from Spec

| Question | Design Decision |
|----------|----------------|
| None — all deferred to Design | All decisions documented above |

---

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-05-24 | Initial design document | SDD Design |
