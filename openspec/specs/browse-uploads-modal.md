# Browse Uploads Modal — Specs

## Requirements

### R1: BrowseUploadsModal component
- **R1.1**: New component `BrowseUploadsModal` renders as a centered modal overlay with semi-transparent backdrop
- **R1.2**: Displays the list of uploaded images (reusing the upload listing logic from UploadGallery)
- **R1.3**: Shows an "X" close button in the top-right corner
- **R1.4**: Closes on Escape key press
- **R1.5**: Closes on backdrop click
- **R1.6**: Traps focus inside the modal while open
- **R1.7**: Prevents body scroll while open
- **R1.8**: Accepts `onPick(url: string)` and `onClose()` callbacks as props
- **R1.9**: Accepts optional `open: boolean` prop to control visibility

### R2: DynamicField ImageField modification
- **R2.1**: Replace the `navigate('/uploads?mode=pick&returnTo=...')` call with a callback prop `onBrowseUploads(fieldIndex: number)`
- **R2.2**: The "Browse Uploads" button is always visible when the ImageField has no value
- **R2.3**: The "Browse Uploads" button is also visible when the field has a value (to replace the image)

### R3: ToolRunner modal management
- **R3.1**: ToolRunner manages a `browseFieldIndex: number | null` state to track which field initiated the browse
- **R3.2**: ToolRunner renders `BrowseUploadsModal` when `browseFieldIndex !== null`
- **R3.3**: ToolRunner passes `onImagePick` to each DynamicField ImageField instance
- **R3.4**: When `onImagePick(url)` is called, ToolRunner updates the specific field's value and closes the modal
- **R3.5**: All other form field values remain unchanged during the entire flow

### R4: Fallback navigation
- **R4.1**: The old navigation-based flow is preserved as a fallback when the modal cannot be rendered (e.g., SSR, error boundary)
- **R4.2**: The fallback is opt-in via a prop `fallbackToNavigation: boolean`

## Scenarios

### S1: Happy path — Browse and select an image
1. User fills field1 (text), field2 (text), field3 (IMAGE, empty)
2. User clicks "Browse Uploads" on field3
3. Modal opens showing uploaded images
4. User clicks on an image
5. Modal closes, field3 now has the selected image URL
6. field1 and field2 values are unchanged
7. User continues filling the form

### S2: Cancel without selecting
1. User clicks "Browse Uploads" on an IMAGE field
2. Modal opens
3. User presses Escape
4. Modal closes, field value is unchanged
5. Form state is fully preserved

### S3: Replace an existing image
1. IMAGE field already has a value (e.g., `https://.../image.png`)
2. User clicks "Browse Uploads"
3. Modal opens
4. User selects a different image
5. Field value is replaced with the new URL
6. Previous image URL is lost

### S4: Close by clicking backdrop
1. Modal is open
2. User clicks on the semi-transparent backdrop outside the modal
3. Modal closes
4. No image is selected
5. Form state is fully preserved

## Acceptance Criteria

- [ ] A new `BrowseUploadsModal.tsx` component exists in `client/src/components/`
- [ ] In `DynamicField.tsx`, the ImageField no longer calls `navigate()` for "Browse Uploads"
- [ ] In `ToolRunner.tsx`, modal state is managed with `browseFieldIndex`
- [ ] Clicking "Browse Uploads" on any IMAGE field opens the modal
- [ ] Selecting an image fills ONLY the triggering field
- [ ] Cancelling (Escape, backdrop click, X button) closes the modal without changes
- [ ] Form state for ALL fields is preserved throughout
- [ ] Focus is trapped inside the modal while open
- [ ] Body scroll is prevented while modal is open
- [ ] Existing navigation-based flow still works as fallback
