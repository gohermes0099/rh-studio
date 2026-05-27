# Delta for Browse Uploads Modal

## ADDED Requirements

### Requirement: Browse Uploads Modal for IMAGE Fields

The system SHALL provide an inline modal interface for browsing and selecting existing uploads when using IMAGE fields, preserving form state during the selection process.

#### Scenario: User opens browse uploads modal from IMAGE field
- GIVEN user is on a ToolRunner page with at least one IMAGE field
- WHEN user clicks the "Browse Uploads" button on an IMAGE field
- THEN the BrowseUploadsModal component opens as an overlay
- AND the modal renders the UploadGallery component in pick mode
- AND the underlying ToolRunner form remains mounted and visible
- AND all current form field values are preserved

#### Scenario: User selects an upload from the modal
- GIVEN BrowseUploadsModal is open showing available uploads
- WHEN user clicks on an upload thumbnail in the gallery
- THEN the modal closes
- AND the specific IMAGE field that triggered the modal is updated with the selected upload's fileName
- AND no other form field values are affected
- AND focus returns to the triggering IMAGE field element

#### Scenario: User cancels browse uploads modal
- GIVEN BrowseUploadsModal is open
- WHEN user clicks the modal backdrop or presses the Escape key
- THEN the modal closes
- AND no changes are made to any form field values
- AND focus returns to the triggering IMAGE field element

#### Scenario: Modal handles upload gallery loading states
- GIDEN BrowseUploadsModal is open
- WHEN the UploadGallery component is loading uploads
- THEN the modal shows a loading indicator
- AND user interactions with gallery items are disabled during loading
- AND error states from the gallery are displayed appropriately in the modal

## MODIFIED Requirements

### Requirement: IMAGE Field Browse Uploads Behavior

The system SHALL modify the IMAGE field's browse uploads interaction from page navigation to inline modal while maintaining backward compatibility.
(Previously: Clicking "Browse Uploads" navigated to /uploads page, causing ToolRunner unmount and form state loss)

#### Scenario: Modal preferred over navigation for IMAGE fields
- GIDEN user is on a ToolRunner page with IMAGE fields
- WHEN user clicks "Browse Uploads" on an IMAGE field
- THEN the BrowseUploadsModal opens instead of navigating to /uploads
- AND form state is preserved throughout the interaction
- AND the existing navigation behavior is retained as a fallback for non-modal usage

#### Scenario: Fallback navigation preservation
- GIDEN the modal system is disabled or unavailable
- WHEN user clicks "Browse Uploads" on an IMAGE field
- THEN the system falls back to navigating to /uploads?mode=pick&returnTo=...
- AND this behavior matches the pre-change functionality exactly

## REMOVED Requirements

### Requirement: Full-page navigation for IMAGE field browse uploads

(Reason: Replaced with inline modal approach to preserve form state during upload selection)