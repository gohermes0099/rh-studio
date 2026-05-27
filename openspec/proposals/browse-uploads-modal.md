# Proposal: Browse Uploads Modal

## Intent

When a user clicks "Browse Uploads" on an IMAGE field in ToolRunner, DynamicField.tsx calls navigate('/uploads?mode=pick&returnTo=...') which:
1. Unmounts ToolRunner — all form state is lost
2. UploadGallery in pick mode navigates back
3. ToolRunner only pre-fills the FIRST IMAGE field (line 45)
4. All other form field values are reset

This creates a poor user experience where users lose all their form data when trying to browse and select an upload for any IMAGE field beyond the first one.

## Scope

### In Scope
- Create new `BrowseUploadsModal` component (inline modal overlay)
- Modify `DynamicField.ImageField` to open the modal instead of navigating
- Modify `ToolRunner` to pass `onImagePick` callback per field
- When user picks an image, fill the specific IMAGE field and close modal
- Preserve all form state during the upload browsing process
- Keep existing navigation as fallback for non-modal usage

### Out of Scope
- Changes to Gallery.tsx, server routes, or API client
- Removing existing navigation-based approach entirely
- Modifying non-IMAGE field types
- Changes to UploadGallery component beyond ensuring it works in modal context

## Approach

1. Create a new `BrowseUploadsModal` component in `client/src/components/BrowseUploadsModal.tsx` that renders UploadGallery in a modal overlay
2. Modify `DynamicField.tsx` to conditionally render the browse button to either:
   - Navigate to /uploads (current behavior for non-modal usage)
   - Open the BrowseUploadsModal (new preferred behavior)
3. Update `ToolRunner.tsx` to:
   - Manage modal state (open/close)
   - Pass a unique `onImagePick` callback to each IMAGE field instance
   - Update the specific field's value when an image is picked
4. Ensure the modal properly handles focus trapping, escape key to close, and backdrop click behavior
5. Use the existing UploadGallery component with mode="pick" inside the modal

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Modal conflicts with existing modals (z-index) | Medium | Use consistent z-index values from design system, ensure proper modal stacking |
| Focus management issues | Medium | Implement focus trapping, return focus to trigger element on close |
| Accessibility compliance | Low | Follow ARIA modal patterns, proper labeling, keyboard navigation |
| Modal state not properly cleaned up | Low | Use proper cleanup in useEffect, prevent memory leaks |
| Styling inconsistencies with existing modals | Low | Reuse existing modal styling patterns from ImageCropModal |

## Dependencies
- Existing UploadGallery component with pick mode support
- Existing modal styling and behavior patterns (from ImageCropModal)
- React state management for modal visibility