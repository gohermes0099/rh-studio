# Tasks: Browse Uploads Modal

## Review Workload Forecast

| Metric | Value |
|--------|-------|
| New files | 1 (`BrowseUploadsModal.tsx`) |
| Modified files | 2 (`DynamicField.tsx`, `ToolRunner.tsx`) |
| Estimated changed lines | ~120-180 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Decision needed before apply | No |

A single PR is fine for this change.

## Implementation Order

```
T1 (create BrowseUploadsModal)
  |
  v
T2 (modify DynamicField ImageField)
  |
  v
T3 (modify ToolRunner)
```

## Task List

### T1: Create BrowseUploadsModal component

**Description**: New component that renders as a centered modal overlay with:
- Semi-transparent backdrop
- Close button (X) in top-right corner
- Escape key closes modal
- Backdrop click closes modal
- Focus trapping (tab cycles within modal)
- Body scroll lock while open
- Fetches and displays uploaded images (reuses upload listing)

**Files**: `client/src/components/BrowseUploadsModal.tsx` (NEW)

**Props interface**:
```typescript
interface BrowseUploadsModalProps {
  open: boolean;
  onPick: (url: string) => void;
  onClose: () => void;
}
```

**Implementation notes**:
- Follow the same pattern as `ImageCropModal.tsx` for modal styling
- Fetch uploads via `api/client.ts` listUploads endpoint
- Display images in a grid layout similar to UploadGallery
- Add loading state while fetching
- Add empty state if no uploads exist

**Estimated lines**: ~80-100

**Dependencies**: None

---

### T2: Modify DynamicField ImageField to use callback

**Description**: Replace the `navigate('/uploads?mode=pick&returnTo=...')` call in `ImageField.handleBrowseUploads` with a call to `onBrowseUploads(fieldIndex)` prop.

**Files**: `client/src/components/DynamicField.tsx` (MODIFY)

**Changes**:
1. Add `onBrowseUploads?: (fieldIndex: number) => void` to `FieldProps` interface
2. In `ImageField` or wherever `handleBrowseUploads` lives, replace `navigate(...)` with `props.onBrowseUploads?.(fieldIndex)`
3. Keep the "Browse Uploads" button visible regardless of whether the field has a value

**Estimated lines**: ~10-20

**Dependencies**: None (can be done before T1, the callback just won't do anything yet)

---

### T3: Add modal state management to ToolRunner

**Description**: Add `browseFieldIndex` state to ToolRunner, render `BrowseUploadsModal` when active, and handle image pick callback.

**Files**: `client/src/pages/ToolRunner.tsx` (MODIFY)

**Changes**:
1. Import `BrowseUploadsModal`
2. Add state: `const [browseFieldIndex, setBrowseFieldIndex] = useState<number | null>(null)`
3. Pass `onBrowseUploads={(i) => setBrowseFieldIndex(i)}` to each `DynamicField`
4. Render `<BrowseUploadsModal open={browseFieldIndex !== null} onPick={handleImagePick} onClose={() => setBrowseFieldIndex(null)} />`
5. Implement `handleImagePick(url: string)`: update `values[browseFieldIndex] = url`, then `setBrowseFieldIndex(null)`

**Estimated lines**: ~30-50

**Dependencies**: T1 (needs BrowseUploadsModal to exist), T2 (needs DynamicField to have the callback prop)

---

## Commit Plan (Work Units)

1. **`feat(client): add BrowseUploadsModal component`** — T1 alone
2. **`feat(client): replace navigate with callback in DynamicField ImageField`** — T2 alone
3. **`feat(client): integrate BrowseUploadsModal in ToolRunner`** — T3 alone

Each commit is independently reviewable and testable.
