# Delta Spec: gallery-task-improvements

## Summary

Three UX improvements to reduce friction when re-running generations: surfacing the prompt in the gallery (F1), adding a Repeat button to TaskDetail (F2), and supporting batch creation in ToolRunner (F3).

---

## ADDED Requirements

### Requirement: F1-Gallery-Prompt-Storage

The system MUST store the prompt text used to generate each gallery item in the `gallery_items` table when a task completes.

#### Scenario: Extract prompt from nodeInfoList on task completion

- GIVEN a task with status COMPLETED and `nodeInfoList` containing fields
- WHEN the task poller saves results via `saveGalleryResults()`
- THEN the system extracts the prompt by finding the first field where `fieldName.toLowerCase()` matches `prompt`, `positive prompt`, or `positive_prompt`
- AND stores it in the `prompt` column of `gallery_items`

#### Scenario: Handle missing or non-standard prompt field name

- GIVEN a task completes but no field matches prompt/positive prompt patterns
- WHEN extracting the prompt
- THEN the system falls back to the first STRING-type field, logging a warning
- AND stores the extracted value (or empty string if nothing found)

### Requirement: F1-Gallery-Prompt-API

The system MUST return the prompt in GET /api/gallery responses for each gallery item.

#### Scenario: Return prompt for items with stored prompt

- GIVEN a gallery item with a non-null prompt
- WHEN the gallery items endpoint is queried
- THEN each item includes `"prompt": "<stored value>"`

#### Scenario: Return null for items without prompt (pre-migration)

- GIVEN a gallery item where prompt is NULL or empty (created before migration)
- WHEN the gallery items endpoint is queried
- THEN each item includes `"prompt": null`

### Requirement: F1-Gallery-Prompt-Display

The system MUST display the prompt in the Gallery overlay info panel between the datetime and action buttons.

#### Scenario: Display stored prompt

- GIVEN a gallery item with a non-empty prompt
- WHEN the user clicks to view the overlay
- THEN the prompt appears below the datetime in the info panel

#### Scenario: Display fallback for missing prompt

- GIVEN a gallery item with empty/null prompt (pre-migration item)
- WHEN the user clicks to view the overlay
- THEN "Prompt no disponible" is displayed in gray/muted styling

---

## ADDED Requirements

### Requirement: F2-TaskDetail-RepeatButton

The system MUST provide a Repeat button in TaskDetail that re-submits the original nodeInfoList and navigates to the new task on success.

#### Scenario: Repeat successful task

- GIVEN a task that has completed (any status except PENDING/RUNNING)
- WHEN the user clicks "Repeat generation"
- THEN the system calls `api.runTask(task.toolId, parsedNodeInfoList)` with original fields
- AND on success, navigates to `/history/${newTask.id}`

#### Scenario: Repeat button shows loading state

- GIVEN the user clicked "Repeat generation"
- WHEN the repeat task is being created
- THEN the button shows "Repitiendo..." and is disabled

#### Scenario: Repeat fails with error

- GIVEN the user clicks "Repeat generation"
- WHEN the API call fails
- THEN the error message is displayed inline
- AND the button is re-enabled for retry

---

## ADDED Requirements

### Requirement: F3-ToolRunner-BatchQuantity

The system MUST support creating multiple tasks in sequence from a single submission.

#### Scenario: Create single task (Quantity=1)

- GIVEN Quantity is set to 1
- WHEN the user clicks Run
- THEN exactly 1 task is created
- AND navigation goes to that task's detail page

#### Scenario: Create batch tasks sequentially

- GIVEN Quantity is set to N (2-10)
- WHEN the user clicks Run
- THEN N tasks are created one-by-one, awaiting each API call before the next
- AND on success, navigation goes to the first task's detail page

#### Scenario: Batch stops on failure

- GIVEN Quantity is set to N (>1)
- WHEN iteration M (where M<N) fails
- THEN no further tasks are created
- AND the error for iteration M is displayed
- AND the button is re-enabled for retry

#### Scenario: Quantity input validation

- GIVEN the user enters a quantity outside 1-10
- WHEN attempting to submit
- THEN the Run button is disabled or shows validation error

#### Scenario: Submit button shows progress

- GIVEN Quantity > 1 and user submits
- WHILE tasks are being created
- THEN the button displays "Creando tareas... (X/N)"

---

## Data Model Changes

| Table | Column | Type | Nullable | Default | Notes |
|-------|-------|------|----------|---------|-------|
| gallery_items | prompt | TEXT | YES | NULL | Stores prompt text used to generate |

---

## API Contract Changes

### GET /api/gallery

```json
// Response (added field)
{
  "items": [
    {
      "id": 1,
      "toolId": 2,
      "toolName": "GPT Image 2",
      "fileName": "abc123.png",
      "outputType": "png",
      "nodeId": "node_42",
      "createdAt": "2025-05-27T10:00:00Z",
      "prompt": "A serene mountain landscape at sunset" // NEW FIELD
    }
  ]
}
```

---

## UI Component Changes

### GalleryOverlay

| Location | Element | Change |
|----------|---------|--------|
| Info panel | Between datetime and action buttons | Added prompt display |

HTML structure after change:
```jsx
<p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
  {new Date(selectedImage.createdAt).toLocaleString()}
</p>
{/* NEW: Prompt section */}
<div style={{ marginTop: 8 }}>
  {selectedImage.prompt ? (
    <p style={{ fontSize: '0.85rem', color: 'var(--text-normal)' }}>
      {selectedImage.prompt}
    </p>
  ) : (
    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
      Prompt no disponible
    </p>
  )}
</div>
{/* Actions remain in place */}
<div>...</div>
```

### TaskDetail

| Location | Element | Change |
|----------|---------|--------|
| Below Input Fields card | Button | Added "Repeat generation" |

Button appears for all tasks with status ≠ PENDING/RUNNING.

### ToolRunner

| Location | Element | Change |
|----------|---------|--------|
| Form (above Run button) | Input | Added numeric "Quantity" input (min=1, max=10, default=1) |

---

## Edge Cases

### F1: Gallery Prompt

| Edge Case | Handling |
|-----------|----------|
| Old gallery items (pre-migration) have NULL prompt | Display "Prompt no disponible" |
| Prompt field has unicode/special chars | Store raw string, display with CSS handling |
| Very long prompt (>2000 chars) | Truncate at 2000 with ellipsis in UI |

### F2: TaskDetail Repeat

| Edge Case | Handling |
|-----------|----------|
| Original task had no input fields | Still allows repeat (creates empty task) |
| API rate limits on rapid repeats | Error message shown, user can retry |
| Network failure mid-repeat | Error shown, button re-enabled |
| Repeating a FAILED task | Still creates new task (same inputs, may fail again) |

### F3: ToolRunner Batch

| Edge Case | Handling |
|-----------|----------|
| Quantity entered as decimal | Round to nearest integer within range |
| User changes fields between iterations | Fields are captured at first submission, reused for all |
| Server timeout on iteration N | Treated as failure, stops batch |
| All N tasks succeed | Navigate to first task only |

---

## Acceptance Criteria

- [ ] Gallery overlay shows the exact prompt text used to generate each image (or fallback)
- [ ] GET /api/gallery returns `prompt` field for all items
- [ ] TaskDetail "Repeat generation" button appears and navigates to new task on success
- [ ] ToolRunner "Quantity" input accepts 1-10, creates tasks sequentially
- [ ] Batch stops immediately if any task creation fails
- [ ] Existing gallery items (pre-change) show "Prompt no disponible"