# Design: Browse Uploads Modal

## Technical Approach

The Browse Uploads Modal change implements an inline modal overlay for browsing and selecting uploads, replacing the current navigation-based approach that causes form state loss. The modal reuses the existing UploadGallery component in 'pick' mode, displaying it within a modal container instead of navigating to a separate page. This preserves all form state during the upload browsing process.

## Architecture Decisions

### Decision: Modal Implementation Approach

**Choice**: Create a new `BrowseUploadsModal` component that wraps UploadGallery in a modal overlay with focus trapping and proper accessibility features.

**Alternatives considered**: 
- Modify UploadGallery to detect when it should render as modal vs full page
- Create a higher-order component that conditionally renders UploadGallery in different contexts
- Use a portal-based modal implementation with ReactDOM.createPortal

**Rationale**: 
- Keeping UploadGallery unchanged preserves existing functionality for non-modal usage
- A dedicated modal component provides clear separation of concerns
- Following the existing pattern from ImageCropModal ensures consistency in styling and behavior
- Portal-based approach would require more complex refactoring without significant benefits

### Decision: State Management Location

**Choice**: ToolRunner manages `browseFieldIndex: number | null` state to track which field initiated the browse, and passes `onImagePick` callbacks to each DynamicField instance.

**Alternatives considered**:
- Using a global state management solution (Context API or external library)
- Storing modal state in the BrowseUploadsModal component itself
- Having each DynamicField manage its own modal state

**Rationale**:
- ToolRunner already manages form values state, making it the natural place for browse state
- Centralized state prevents multiple modals from opening simultaneously
- Following React best practices of lifting state up to the common ancestor
- Avoids prop drilling complexity by passing callbacks directly to field instances

### Decision: Focus Trapping Implementation

**Choice**: Implement focus trapping using a combination of tab event handling and initial focus on the first focusable element in the modal.

**Alternatives considered**:
- Using a focus-trap library like focus-trap-react
- Relying on browser's default modal behavior
- Using the inert attribute (not widely supported)

**Rationale**:
- Custom implementation gives us full control over focus behavior
- Avoids adding dependencies for a relatively simple feature
- Ensures compatibility with our existing styling and component structure
- Follows the same approach used in other modals in the codebase

## Data Flow

```
User clicks "Browse Uploads" on ImageField
        │
        ▼
DynamicField calls onBrowseUploads(fieldIndex) prop
        │
        ▼
ToolRunner sets browseFieldIndex = fieldIndex
        │
        ▼
ToolRunner renders BrowseUploadsModal with open={true}
        │
        ▼
BrowseUploadsModal fetches uploads via api.listUploads()
        │
        ▼
User selects an image in the modal gallery
        │
        ▼
BrowseUploadsModal calls onPick(url) prop
        │
        ▼
ToolRunner receives onImagePick(url) callback
        │
        ▼
ToolRunner updates values[browseFieldIndex] = url
        │
        ▼
ToolRunner sets browseFieldIndex = null (closes modal)
        │
        ▼
Form continues with preserved state
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `client/src/components/BrowseUploadsModal.tsx` | Create | New modal component that wraps UploadGallery in a modal overlay with backdrop, close button, focus trapping, and escape key handling |
| `client/src/components/DynamicField.tsx` | Modify | Replace navigate() call in ImageField.handleBrowseUploads with onBrowseUploads prop call; add onBrowseUploads prop to FieldProps interface |
| `client/src/pages/ToolRunner.tsx` | Modify | Add browseFieldIndex state; render BrowseUploadsModal when browseFieldIndex !== null; pass onImagePick callback to DynamicField instances; update specific field value when image is picked |
| `client/src/components/ImageCropModal.tsx` | Reference | Used as pattern for modal styling, focus handling, and backdrop behavior (no changes needed) |

## Interfaces / Contracts

### BrowseUploadsModal Props

```typescript
interface BrowseUploadsModalProps {
  open: boolean;
  onPick: (url: string) => void;
  onClose: () => void;
}
```

### DynamicField ImageField Props Addition

```typescript
interface FieldProps {
  // ... existing props
  onBrowseUploads?: (fieldIndex: number) => void;
}
```

### ToolRunner State Addition

```typescript
interface ToolRunnerState {
  // ... existing state
  browseFieldIndex: number | null;
}
```

### Callback Flow

1. DynamicField.ImageField calls `onBrowseUploads(fieldIndex)` when "Browse Uploads" button is clicked
2. ToolRunner receives call and sets `browseFieldIndex = fieldIndex`
3. ToolRunner renders `<BrowseUploadsModal open={browseFieldIndex !== null} onPick={handleImagePick} onClose={handleModalClose} />`
4. BrowseUploadsModal calls `onPick(url)` when user selects an image
5. ToolRunner receives `handleImagePick(url)` and updates `values[browseFieldIndex] = url` then sets `browseFieldIndex = null`
6. ToolRunner receives `handleModalClose()` and sets `browseFieldIndex = null` (for Escape/backdrop/X button)

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | BrowseUploadsModal open/close behavior | Render with open prop toggles; test onPick/onClose callbacks fire correctly |
| Unit | Focus trapping in modal | Test that tab key cycles through focusable elements and doesn't escape modal |
| Unit | Escape key and backdrop click close modal | Simulate keyDown/click events and verify onClose callback fires |
| Unit | DynamicField ImageField uses onBrowseUploads prop | Mock onBrowseUploads and verify it's called instead of navigate() |
| Unit | ToolRunner manages browseFieldIndex correctly | Test state updates when onBrowseUploads called and image picked |
| Integration | Full modal workflow | Render ToolRunner with IMAGE field, click browse, select image, verify only target field updates |
| Integration | Form state preservation | Fill multiple fields, browse for image, verify non-IMAGE fields retain values |
| Integration | Modal close without selection | Test Escape, backdrop click, and X button all close modal without changing field values |

## Migration / Rollout

No migration required. This change is purely frontend and doesn't affect data structures or APIs. The existing navigation-based flow is preserved as a fallback via the `fallbackToNavigation` prop (though not implemented in this change as it was marked as out of scope).

## Open Questions

- [ ] Should we implement the fallbackToNavigation prop to preserve the exact navigation-based flow as a fallback, or is the existing behavior sufficient?
- [ ] Should we add animation to the modal open/close for better UX?
- [ ] Should we restrict the modal to only show images in pick mode, or keep the current UploadGallery behavior showing all media types?

## Next Step
Ready for tasks (sdd-tasks).