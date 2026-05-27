# Tasks: gallery-task-improvements

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~140 |
| 800-line budget risk | Low |

Chained PRs recommended: No
Delivery strategy: force-chained
Decision needed before apply: No

### Suggested Work Units

Single PR covers all features (under 800-line budget):

| Unit | Goal | PR |
|------|------|-----|
| 1 | All features (F1 + F2 + F3) | PR 1 — single deliverable |

---

## Phase 1: F1 — Gallery Prompt Display (Backend)

- [x] 1.1 Add `prompt TEXT DEFAULT ''` column in migrations (`server/src/db/migrations.ts`)
- [x] 1.2 Add `prompt?: string` to SaveOptions in galleryStore.ts
- [x] 1.3 Add `extractPrompt()` helper function in galleryStore.ts
- [x] 1.4 Update INSERT in saveGalleryResults() to include prompt
- [x] 1.5 Update listGalleryItems() SELECT to include prompt column
- [x] 1.6 Pass prompt to saveGalleryResults() in tasks.ts save flow

---

## Phase 2: F1 — Gallery Prompt Display (Frontend + API)

- [x] 2.1 Update listGallery API type in client/src/api/client.ts
- [x] 2.2 Update GalleryItem interface in Gallery.tsx
- [x] 2.3 Display prompt in overlay between datetime and buttons

---

## Phase 3: F2 — TaskDetail Repeat Button

- [x] 3.1 Import api and navigate hooks in TaskDetail.tsx
- [x] 3.2 Add "Repeat generation" button (disabled for PENDING/RUNNING)
- [x] 3.3 Implement click handler: parse nodeInfoList, call api.runTask(), navigate on success
- [x] 3.4 Add loading state: show "Repitiendo..." and disable button while submitting

---

## Phase 4: F3 — ToolRunner Batch Quantity

- [x] 4.1 Add quantity state (useState<number>(1))
- [x] 4.2 Add numeric input before Run button (min=1, max=10)
- [x] 4.3 Convert handleRun to async function
- [x] 4.4 Loop: for i = 1 to quantity, await api.runTask()
- [x] 4.5 Track firstTaskId for navigation destination
- [x] 4.6 Show "Creando tareas... (X/N)" during loop
- [x] 4.7 Stop on failure: show error, re-enable button

---

## Files to Modify

| File | Est. Lines | Features |
|------|-----------|----------|
| server/src/db/migrations.ts | 5 | F1 |
| server/src/services/galleryStore.ts | 25 | F1 |
| server/src/routes/tasks.ts | 10 | F1 |
| server/src/routes/gallery.ts | 5 | F1 |
| client/src/api/client.ts | 5 | F1 |
| client/src/pages/Gallery.tsx | 20 | F1 |
| client/src/pages/TaskDetail.tsx | 40 | F2 |
| client/src/pages/ToolRunner.tsx | 30 | F3 |
| **Total** | **~140** | |
