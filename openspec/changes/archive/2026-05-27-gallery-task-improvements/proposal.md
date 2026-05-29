# Proposal: Gallery Task Improvements

## Intent

Three UX improvements that reduce friction when re-running generations: surfacing the prompt in the gallery, adding a Repeat button to TaskDetail, and supporting batch creation in ToolRunner.

Grouping these into one change because they share the same persistence layer (gallery_items table, task nodeInfoList) and the same API endpoint (POST /api/tasks/run).

## Scope

### In Scope
- **F1 — Gallery prompt display**: Add `prompt` column to `gallery_items`, extract it from `nodeInfoList` on task completion, return in GET /api/gallery, show in Gallery UI
- **F2 — TaskDetail Repeat button**: Re-submit the original `nodeInfoList` + `toolId` via POST /api/tasks/run, navigate to new task on success
- **F3 — ToolRunner batch count**: Numeric "Quantity" input (1-10), create tasks sequentially, navigate to first task on success

### Out of Scope
- Gallery image editing or re-use flows beyond showing the prompt
- Bulk operations on task history
- Changes to prompt storage UI (only reading existing prompts from nodeInfoList)

## Capabilities

### New Capabilities
- `gallery-prompt`: Gallery items now store and display the prompt text used to generate them

### Modified Capabilities
- None

## Approach

### F1 — Gallery prompt display

1. **Migration** (`server/src/db/migrations.ts`):
   ```sql
   ALTER TABLE gallery_items ADD COLUMN prompt TEXT;
   ```

2. **Prompt extraction** (`server/src/services/galleryStore.ts` — `SaveOptions`):
   - Add optional `prompt?: string` to `SaveOptions`
   - Before calling the INSERT, scan `nodeInfoList` for the first field where `fieldName.toLowerCase()` matches `prompt` or `positive_prompt`
   - Extract `fieldValue` and pass it to the INSERT

3. **Task completion** (`server/src/routes/tasks.ts`):
   - When saving results via `saveGalleryResults`, extract the prompt from `nodeInfoList` (already available in scope) and pass it

4. **API response** (`server/src/routes/gallery.ts`):
   - Add `prompt: item.prompt ?? null` to the mapped item in GET /

5. **Gallery UI** (`client/src/pages/Gallery.tsx`):
   - Add `prompt?: string` to `GalleryItem` interface
   - Show prompt in the overlay info panel below tool name (fallback: "Prompt not available")

### F2 — TaskDetail Repeat button

- In `TaskDetail.tsx`, parse `task.nodeInfoList` back to `RhNodeField[]`
- Add "Repeat generation" button below the input fields card
- On click: call `api.runTask(task.toolId, parsedNodeInfoList)`, navigate to `/history/${result.task.id}`
- Show loading state while the repeat task is being created

### F3 — ToolRunner batch count

- Add `<input type="number" min="1" max="10" defaultValue={1}>` labeled "Quantity" above the Run button
- `handleRun` becomes async and loops `count` times, awaiting each `api.runTask(...)` call before starting the next
- On success of first task: navigate to its detail
- On any failure: stop and show error

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `server/src/db/migrations.ts` | Modified | Add `prompt` column to `gallery_items` |
| `server/src/services/galleryStore.ts` | Modified | Accept and store `prompt` in save results |
| `server/src/routes/tasks.ts` | Modified | Extract and pass prompt when saving results |
| `server/src/routes/gallery.ts` | Modified | Return `prompt` in GET / |
| `client/src/pages/Gallery.tsx` | Modified | Display prompt in overlay panel |
| `client/src/pages/TaskDetail.tsx` | Modified | Add Repeat button |
| `client/src/pages/ToolRunner.tsx` | Modified | Add Quantity input, loop submissions |
| `client/src/api/client.ts` | Modified | Update `GalleryItem` type |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Prompt field name is not "prompt" or "positive_prompt" | Medium | Fall back to first STRING field; log a warning |
| Sequential batch creates tasks too slowly | Low | Cap quantity at 10; tasks run server-side anyway |
| Existing gallery items have no prompt | Low | UI shows "Prompt not available" gracefully |

## Rollback Plan

1. Migration rollback: `ALTER TABLE gallery_items DROP COLUMN prompt` (data loss — acceptable since prompt was never captured for old items)
2. Revert `galleryStore.ts` to not accept/store `prompt`
3. Revert `gallery.ts` to not return `prompt`
4. Remove Repeat button from `TaskDetail.tsx`
5. Remove Quantity input from `ToolRunner.tsx`

## Dependencies

- Existing POST /api/tasks/run endpoint (already implemented)
- Existing `gallery_items` table (already exists)
- `nodeInfoList` stored on task (already implemented)

## Success Criteria

- [ ] Gallery overlay shows the exact prompt text used to generate each image
- [ ] TaskDetail "Repeat" navigates to the new task on success
- [ ] ToolRunner "Quantity" creates exactly N tasks sequentially (N=1..10)
- [ ] Existing gallery items (pre-change) show "Prompt not available" instead of empty
- [ ] Prompt extraction handles fields named "prompt", "Positive Prompt", and similar variants
- [ ] Batch loop stops immediately and shows error if any task creation fails