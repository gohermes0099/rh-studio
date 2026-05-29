# imgbb-migration Specification

## Purpose

Migrate all image storage from local filesystem (`uploads/` + `downloads/`) to imgbb cloud storage. This enables deploying on Netlify (no local filesystem) while using Supabase for relational data. imgbb handles hosting; RunningHub continues for AI generation.

## Requirements

### Requirement: StorageService Interface Abstraction

The system MUST provide a `StorageService` interface that abstracts image storage backends. The interface MUST support switching between local filesystem and imgbb implementations without breaking consuming code.

#### Scenario: Upload via StorageService

- GIVEN a StorageService implementation is configured
- WHEN `upload(buffer, fileName, mimeType)` is called
- THEN the service MUST return `{url: string, thumbnailUrl: string}`
- AND the URL MUST be a publicly accessible CDN URL

#### Scenario: Retrieve URL for Stored Key

- GIVEN an image key was previously uploaded
- WHEN `url(key)` is called
- THEN the service MUST return the CDN URL for that key

---

### Requirement: imgbbService Client Upload

The system MUST provide an `imgbbService` that wraps the imgbb API for direct browser uploads.

#### Scenario: Upload Image to imgbb

- GIVEN a Buffer containing image data, a fileName, and mimeType
- WHEN `imgbbService.upload(buffer, fileName, mimeType)` is called
- THEN the service MUST POST to `https://api.imgbb.com/1/upload` with base64-encoded image
- AND MUST include the API key from configuration
- AND on success return `{url, thumbnailUrl, deleteUrl}`

#### Scenario: Handle imgbb API Timeout

- GIVEN imgbb API is slow or unresponsive
- WHEN upload request exceeds timeout (30s default)
- THEN the service MUST throw an error with code TIMEOUT
- AND the error message MUST indicate retry is possible

#### Scenario: Handle imgbb API Error

- GIVEN imgbb API returns an error response
- WHEN the upload fails with HTTP error
- THEN the service MUST throw a mapped error with appropriate code
- AND the error message MUST be user-friendly

---

### Requirement: Client Direct Upload Flow

The client MUST enable users to upload images directly to imgbb from the browser without routing through the backend.

#### Scenario: User Uploads via UploadGallery

- GIVEN the user selects an image file in UploadGallery
- AND imgbb API key is configured in Settings
- WHEN the user submits the upload
- THEN the client MUST read the API key from localStorage ('imgbbApiKey')
- AND convert the file to base64
- AND POST directly to imgbb API from browser
- AND on success call backend to save metadata to uploads table (url, thumbnailUrl, originalName, mimeType)
- AND display the uploaded image in the gallery

#### Scenario: User Upload Without API Key

- GIVEN the user attempts upload without configuring imgbb API key
- WHEN the user tries to upload
- THEN the UI MUST show an error indicating "imgbb API key required"
- AND link to Settings page to configure

#### Scenario: User Upload Failure with Retry

- GIVEN imgbb upload fails (network error or API error)
- WHEN the upload fails
- THEN the UI MUST show an error message with a "Retry" button
- AND allow the user to retry without re-selecting the file

---

### Requirement: Backend Upload Endpoint Changes

The backend MUST remove local file storage for user uploads while maintaining the endpoint for RunningHub uploads.

#### Scenario: RH Upload Still Uses Backend

- GIVEN a RunningHub task uploads binary image data
- WHEN POST /api/upload receives binary data
- THEN the backend MUST forward to RunningHub (unchanged)
- AND optionally save imgbb URL to uploads table for tracking
- AND NOT save to local uploads/ folder

#### Scenario: Metadata Save After Direct Upload

- GIVEN client successfully uploaded to imgbb directly
- WHEN client calls backend to save metadata
- THEN backend MUST insert record to uploads table with imgbbUrl, imgbbThumbnailUrl, originalName, mimeType

---

### Requirement: Gallery Result Upload Flow

After RunningHub task completion, result images MUST be automatically uploaded to imgbb.

#### Scenario: Auto-upload RH Results to imgbb

- GIVEN a RunningHub task completes with status SUCCESS
- AND the task has result image URLs
- WHEN galleryStore processes the results
- THEN for each result URL: fetch image → upload to imgbb
- AND store imgbb URL in gallery_items (fileName column)
- AND retain original RH URL as originalUrl for reference

#### Scenario: Gallery Items Record Structure

- GIVEN a result image is uploaded to imgbb
- THEN the gallery_items record MUST contain:
  - fileName: imgbb URL (primary display URL)
  - originalUrl: RH result URL
  - outputType, prompt, nodeId, toolId, toolName, taskId

---

### Requirement: Database Schema Updates

The database schema MUST be updated to support imgbb URLs.

#### Scenario: Add imgbb Columns to uploads Table

- GIVEN a migration runs on the uploads table
- THEN add column: `imgbbUrl TEXT`
- AND add column: `imgbbThumbnailUrl TEXT`

#### Scenario: gallery_items Stores imgbb URLs

- GIVEN gallery_items table schema
- THEN fileName column MUST store imgbb URL (not local path)
- AND no fileSize column needed for imgbb-hosted items (handled by imgbb)

---

### Requirement: Gallery Serve Returns imgbb URLs

The gallery API endpoints MUST return imgbb CDN URLs, not local file paths.

#### Scenario: GET /api/gallery Returns imgbb URLs

- GIVEN gallery items exist with imgbb URLs
- WHEN client requests GET /api/gallery
- THEN response MUST include imgbb URLs directly
- AND NOT include local downloads/ paths

#### Scenario: GET /api/gallery/files/:id Serves imgbb

- GIVEN a gallery item ID is requested
- WHEN GET /api/gallery/files/:id is called
- THEN server MUST redirect to imgbb URL
- OR return the imgbb URL for client to use directly

#### Scenario: DELETE Gallery Item (Soft Delete)

- GIVEN a gallery item exists
- WHEN DELETE /api/gallery/:id is called
- THEN soft-delete the item from gallery_items
- AND note: imgbb URL remains valid (imgbb handles deletion separately)

---

### Requirement: Uploads Serve Returns imgbb URLs

The uploads API endpoints MUST serve imgbb URLs.

#### Scenario: GET /api/uploads/:id/file Returns imgbb URL

- GIVEN an upload record with imgbbUrl exists
- WHEN GET /api/uploads/:id/file is called
- THEN server MUST redirect to imgbb URL
- OR proxy the image data

---

### Requirement: Settings UI Configuration

The application MUST provide a Settings page where users configure their imgbb API key.

#### Scenario: Configure imgbb API Key

- GIVEN the user navigates to Settings
- THEN settings MUST include an input for "imgbb API Key"
- AND store the value in localStorage under key 'imgbbApiKey'
- AND include an input for "imgbb Folder" (default empty string)
- AND store in localStorage under key 'imgbbFolder'

#### Scenario: Display Configuration Status

- GIVEN Settings page loads
- THEN UI MUST show status: "Configured" or "Not Configured" for imgbb
- AND validate the key by performing a test upload (tiny test image)
- AND show success/failure indicator

---

### Requirement: Tasks Polling Uploads Results

RunningHub task polling MUST handle imgbb upload after task completion.

#### Scenario: Poll Completed Task with imgbb Upload

- GIVEN a task with status SUCCESS is detected
- WHEN polling handler processes completion
- THEN fetch results from RunningHub (URLs)
- AND upload each result to imgbb via imgbbService
- AND save to gallery_items with imgbb URLs
- AND remove local downloads/ folder usage

---

### Requirement: Client API Wrapper

The client API wrapper MUST abstract imgbb uploads from components.

#### Scenario: uploadFile API Method

- GIVEN `client.uploadFile(file, saveToGallery?)` is called
- THEN the method MUST:
  1. Upload to imgbb directly from browser
  2. Call backend to save metadata
  3. Optionally add to gallery if saveToGallery is true
- AND return the imgbb URL

#### Scenario: listUploads API Method

- GIVEN `client.listUploads()` is called
- THEN return list with imgbb URLs
- AND no binary data from backend

---

### Requirement: CORS Handling for imgbb

The system MUST handle CORS for browser-based imgbb uploads.

#### Scenario: imgbb Allows CORS

- GIVEN imgbb default CORS policy
- THEN direct browser upload SHOULD succeed without config

#### Scenario: imgbb Restricts CORS

- IF imgbb restricts origins
- THEN user MUST configure their Netlify domain in imgbb dashboard
- AND frontend displays instruction if upload fails with CORS error

---

## Migration Notes

### Old Local Path Handling

Existing gallery items with local paths (`downloads/`, `uploads/`) MUST still display correctly.

- GET /api/gallery checks if fileName starts with "http" → assume imgbb URL
- Otherwise treat as local path → attempt legacy serve or show placeholder