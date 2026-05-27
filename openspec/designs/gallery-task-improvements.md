# Design: gallery-task-improvements

## Technical Approach

Three frontend/backend changes sharing the `nodeInfoList` field and the `gallery_items` table:
- **F1** (Gallery prompt): persist extracted prompt on task completion, return via API, display in overlay
- **F2** (TaskDetail Repeat): re-submit original `nodeInfoList` via `POST /api/tasks/run`, navigate to new task
- **F3** (ToolRunner batch): sequential loop of `api.runTask` calls, capped at 10, navigate to first task

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Prompt extraction strategy | Scan `nodeInfoList` for `/prompt/i` match, fallback to first STRING field | Non-invasive — does not change tool structure, only reads existing data |
| Prompt storage location | `gallery_items.prompt` column, not on the task | Gallery survives task cleanup; task has no prompt field today |
| Batch execution model | Sequential `await` in a loop | Simpler than parallel; ensures ordered creation; meets spec requirement |
| Migration approach | Add column only; no re-processing of existing items | Existing items will show "Prompt no disponible" which is acceptable |

## Data Flow

```
F1 — Gallery prompt:
  Task poller (tasks.ts:160-183)
    → queryResult.results → saveGalleryResults({ results, taskId, toolId, toolName })
      → galleryStore.ts INSERT with prompt (extracted from nodeInfoList)
        → listGalleryItems() SELECT prompt
          → GET /api/gallery returns prompt
            → Gallery.tsx overlay displays prompt

F2 — Repeat button:
  TaskDetail.tsx "Repeat generation" click
    → api.runTask(task.toolId, JSON.parse(task.nodeInfoList))
      → POST /api/tasks/run { toolId, nodeInfoList }
        → server inserts new task, returns { task }
          → navigate(/history/${result.task.id})

F3 — Batch quantity:
  ToolRunner.tsx handleRun (Quantity=N)
    → loop i=1..N: await api.runTask(tool.id, buildNodeInfoList())
      → on i=1 success: navigate(/history/${firstTask.id})
      → on any failure: stop, show error, re-enable button
```

## SQL Migration

```sql
-- server/src/db/migrations.ts
ALTER TABLE gallery_items ADD COLUMN prompt TEXT;
```

## API Contract Changes

**GET /api/gallery** — add `prompt: string | null` to each item:

```typescript
// client/src/api/client.ts listGallery() return type:
{ items: Array<{
    id: number; toolId: number; toolName: string;
    fileName: string; outputType: string; nodeId: string;
    createdAt: string;
    prompt: string | null;  // NEW
  }> }
```

**POST /api/tasks/run** — unchanged (F2/F3 reuse existing endpoint).

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `server/src/db/migrations.ts` | Modify | Add `prompt TEXT` column to `gallery_items` |
| `server/src/services/galleryStore.ts` | Modify | Add `prompt?: string` to `SaveOptions`; extract and pass on INSERT; add `prompt` to `listGalleryItems` return type |
| `server/src/routes/tasks.ts` | Modify | Extract prompt from `nodeInfoList` before calling `saveGalleryResults` |
| `server/src/routes/gallery.ts` | Modify | Map `prompt: item.prompt ?? null` in GET / response |
| `client/src/api/client.ts` | Modify | Add `prompt: string \| null` to `GalleryItem` in `listGallery()` type |
| `client/src/pages/Gallery.tsx` | Modify | Add `prompt` to `selectedImage` state; display in overlay between datetime and actions |
| `client/src/pages/TaskDetail.tsx` | Modify | Add "Repeat generation" button (disabled for PENDING/RUNNING); parse `nodeInfoList`, call `api.runTask`, navigate on success |
| `client/src/pages/ToolRunner.tsx` | Modify | Add `quantity` state (number, 1-10); make `handleRun` async loop; show "Creando tareas... (X/N)" during batch |

## Prompt Extraction Algorithm

```typescript
// In saveGalleryResults, before INSERT:
function extractPrompt(nodeInfoList: RhNodeField[]): string {
  for (const field of nodeInfoList) {
    const name = field.fieldName.toLowerCase();
    if (name === 'prompt' || name === 'positive prompt' || name === 'positive_prompt') {
      return field.fieldValue;
    }
  }
  // Fallback: first STRING-type field
  for (const field of nodeInfoList) {
    if (field.fieldType === 'STRING' || field.fieldType === undefined) {
      console.warn('[galleryStore] Prompt field not found, falling back to field:', field.fieldName);
      return field.fieldValue;
    }
  }
  return '';
}
```

## Batch Execution Strategy

```typescript
// ToolRunner.tsx
const [quantity, setQuantity] = useState(1);

const handleRun = async () => {
  setRunning(true);
  setError('');
  try {
    const nodeInfoList = buildNodeInfoList();
    let firstTaskId: number | null = null;

    for (let i = 1; i <= quantity; i++) {
      setRunningLabel(`Creando tareas... (${i}/${quantity})`);
      const result = await api.runTask(tool.id, nodeInfoList);
      if (i === 1) firstTaskId = result.task.id;
    }

    if (firstTaskId) navigate(`/history/${firstTaskId}`);
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to run task');
  } finally {
    setRunning(false);
    setRunningLabel('');
  }
};
```

Error handling: any exception mid-batch stops iteration; error displayed; button re-enabled for retry.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `extractPrompt()` edge cases | Test with mock `RhNodeField[]` (no match, multiple matches, fallback to first STRING) |
| Unit | `SaveOptions.prompt` insertion | Verify SQL includes `?` for prompt column |
| Integration | `GET /api/gallery` returns `prompt` | Call endpoint, assert `prompt` present in item |
| Integration | Repeat button flow | `POST /api/tasks/run` with original `nodeInfoList`, verify new task created |
| Integration | Batch loop stops on failure | Mock `api.runTask` to fail on iteration 2, verify only 1 task created |
| E2E | Gallery overlay shows prompt | UI test: open overlay, assert prompt text or fallback message |
| E2E | Batch navigation to first task | Set quantity=3, verify navigation to first task's history page |

## Migration / Rollout

- No phased rollout needed; column addition is backward-compatible
- Existing `gallery_items` rows have `prompt=NULL` → API returns `null`, UI shows "Prompt no disponible"
- No data migration required; no existing prompts to backfill

## Open Questions

- [ ] None — all three features have sufficient spec detail to proceed