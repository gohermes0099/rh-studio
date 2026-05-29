# Tasks: imgbb-migration

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 600-800 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (server): Groups 1-2, PR 2 (client): Groups 3-4 |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Server-side services and route changes | PR 1 | Base=main; includes imgbbService, storageService, migrations, galleryStore, tasks, upload, uploads, gallery routes |
| 2 | Client-side components and cleanup | PR 2 | Base=PR1; includes types, client, UploadGallery, Settings, cleanup |

## Phase 1: Infrastructure (Foundation)

- [x] 1.1 Create `server/src/services/imgbbService.ts` with ImgbbService class
- [x] 1.2 Implement `upload(buffer, fileName, mimeType)` → POST to imgbb API with base64
- [x] 1.3 Implement `uploadFromUrl(url, fileName?)` for RH result uploads
- [x] 1.4 Map response to {url, thumbnailUrl, deleteUrl}
- [x] 1.5 Add timeout 30s and error handling
- [x] 1.6 Create `server/src/services/storageService.ts` with interface
- [x] 1.7 Define StorageService interface (upload, url, delete methods)
- [x] 1.8 Create factory `createStorageService()` returning imgbb implementation

## Phase 2: Server-side Changes

- [x] 2.1 Update `server/src/db/migrations.ts`: add imgbbUrl TEXT, imgbbThumbnailUrl TEXT to uploads table
- [x] 2.2 Update `server/src/services/galleryStore.ts`: import imgbbService
- [x] 2.3 Implement saveGalleryResults(): for each RH URL, fetch → upload to imgbb → store in gallery_items.fileName
- [x] 2.4 Remove local downloads/ writes from galleryStore
- [x] 2.5 Update `server/src/routes/tasks.ts`: inject imgbbService
- [x] 2.6 On task COMPLETED: call galleryStore with imgbb upload
- [x] 2.7 Remove local file storage from tasks
- [x] 2.8 Update `server/src/routes/upload.ts`: remove local uploads/ writes
- [x] 2.9 Keep RH upload (binary) for RunningHub
- [x] 2.10 Add metadata-only POST handler for direct imgbb uploads
- [x] 2.11 Update `server/src/routes/uploads.ts`: GET /:id/file redirects to imgbbUrl if set
- [x] 2.12 Fallback to serve legacy local files for old records
- [x] 2.13 Update `server/src/routes/gallery.ts`: GET / returns imgbb URLs
- [x] 2.14 GET /files/:id returns 302 redirect to imgbb URL
- [x] 2.15 Handle legacy local paths (fileName doesn't start with 'http')

## Phase 3: Client-side Changes

- [x] 3.1 Update `shared/types.ts`: UploadItem add imgbbUrl, imgbbThumbnailUrl fields
- [x] 3.2 Document GalleryItem.fileName is now imgbb URL in comment
- [x] 3.3 Update `client/src/api/client.ts`: uploadFile() → direct-to-imgbb from browser
- [x] 3.4 Then POST metadata to backend
- [x] 3.5 Return {imgbbUrl, imgbbThumbnailUrl}
- [x] 3.6 Update `client/src/pages/UploadGallery.tsx`: read imgbbApiKey, imgbbFolder from localStorage
- [x] 3.7 Convert file to base64, POST to imgbb API
- [x] 3.8 On success: POST to backend to save metadata
- [x] 3.9 Display imgbbThumbnailUrl as grid thumbnail
- [x] 3.10 Show error with Retry button on failure
- [x] 3.11 Update `client/src/pages/Settings.tsx`: add imgbb section
- [x] 3.12 Add imgbbApiKey input (localStorage 'imgbbApiKey')
- [x] 3.13 Add imgbbFolder input (localStorage 'imgbbFolder')
- [x] 3.14 Add Test Connection button (small test upload)
- [x] 3.15 Show Configured/Not Configured status

## Phase 4: Cleanup

- [x] 4.1 Remove local uploads/ folder usage from code (all references)
- [x] 4.2 Remove local downloads/ folder usage from code
- [x] 4.3 Update .gitignore if uploads/ and downloads/ are empty
- [x] 4.4 Update README to document imgbb configuration
- [x] 4.5 Add setup instructions for obtaining imgbb API key

## Implementation Dependencies

1. Phase 1 creates foundational services — all later phases depend on these
2. Phase 2 routes depend on Phase 1 services being complete
3. Phase 3 client code depends on backend API being ready (after Phase 2)
4. Phase 4 cleanup happens after all features work