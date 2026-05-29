# Design: imgbb-migration

## Technical Approach

Migrate all image storage from local filesystem to imgbb cloud. User uploads go directly from browser to imgbb (no backend in path). RunningHub task results are uploaded to imgbb by the server after task completion. All image URLs in the app point to imgbb CDN, eliminating `uploads/` and `downloads/` dependencies for Netlify deployment.

## Architecture Decisions

### Decision: Direct browser-to-imgbb uploads (not server proxy)

**Choice**: Client uploads directly to imgbb API using key from localStorage
**Alternatives considered**: Server proxies uploads (adds latency, server load, doubles bandwidth)
**Rationale**: imgbb supports CORS. Keeping server out of the upload path simplifies Netlify deployment and reduces server costs. The API key in localStorage is acceptable for personal use (per proposal risk assessment).

### Decision: StorageService interface with imgbb as sole initial implementation

**Choice**: Abstract `StorageService` interface, factory `createStorageService()`, imgbb-only for now
**Alternatives considered**: Hard-code imgbb everywhere, no abstraction
**Rationale**: The proposal explicitly requires the abstraction. Future backends (S3, Cloudflare R2) can slot in without breaking consuming code. Minimal overhead — the interface is thin.

### Decision: Gallery items store imgbb URL directly in `fileName` column (no new column)

**Choice**: `gallery_items.fileName` becomes the imgbb URL string (semantic change, no schema migration needed)
**Alternatives considered**: Add `imgbbUrl` column to gallery_items; keep fileName as local path
**Rationale**: `fileName` is already a string. Storing the URL directly avoids a join. No schema change needed — only semantics of existing column shift. The `originalUrl` column already captures the RH URL for reference.

### Decision: `uploads` table gets explicit `imgbbUrl` / `imgbbThumbnailUrl` columns

**Choice**: Add two new nullable TEXT columns to `uploads` table
**Alternatives considered**: Store imgbb URL in existing `fileName` column (risks confusing RH fileName with imgbb URL)
**Rationale**: `uploads.fileName` stores the RH-sourced filename (e.g. `abc123.png`). Adding explicit imgbb columns keeps the two concerns separate and makes the intent unambiguous.

## Data Flow

```
[User selects file] 
       │
       ▼
[UploadGallery.tsx] ─reads─▶ localStorage (imgbbApiKey, imgbbFolder)
       │
       ▼
[FileReader → base64]
       │
       ▼
[POST https://api.imgbb.com/1/upload?key={apiKey}]
       │
       ▼ on success
[POST /api/upload { imgbbUrl, imgbbThumbnailUrl, originalName, mimeType }]
       │
       ▼
[upload.ts: insert into uploads table]
       │
       ▼
[GET /api/uploads/:id/file] ─redirect 302─▶ imgbbUrl

──────────────────────────────────────────────────────

[Task completes on RunningHub]
       │
       ▼
[tasks.ts: on SUCCESS, call galleryStore.saveGalleryResults()]
       │
       ▼
[galleryStore: for each RH result URL → fetch buffer → imgbbService.upload()]
       │
       ▼
[galleryStore: INSERT into gallery_items { fileName: imgbbUrl, originalUrl: rhUrl }]
       │
       ▼
[GET /api/gallery] → imgbb URLs in fileName field
[GET /api/gallery/files/:id] → redirect 302 to imgbb URL
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `server/src/services/imgbbService.ts` | Create | Imgbb API wrapper: upload(buffer), uploadFromUrl(url) |
| `server/src/services/storageService.ts` | Create | StorageService interface + factory createStorageService() |
| `server/src/services/galleryStore.ts` | Modify | Inject imgbbService; saveGalleryResults() uploads to imgbb |
| `server/src/routes/upload.ts` | Modify | Remove local fs writes; keep RH upload; add metadata-only POST handler |
| `server/src/routes/uploads.ts` | Modify | GET /:id/file → redirect to imgbbUrl if set, else serve local (legacy) |
| `server/src/routes/gallery.ts` | Modify | GET /files/:id → 302 redirect; handle legacy local paths |
| `server/src/routes/tasks.ts` | Modify | Inject imgbbService; on COMPLETED call galleryStore.saveFromRhResults() |
| `server/src/db/migrations.ts` | Modify | Add imgbbUrl, imgbbThumbnailUrl to uploads table |
| `shared/types.ts` | Modify | UploadItem: add imgbbUrl, imgbbThumbnailUrl; GalleryItem note |
| `client/src/pages/UploadGallery.tsx` | Modify | Direct-to-imgbb upload, display imgbbThumbnailUrl |
| `client/src/pages/Settings.tsx` | Modify | imgbb API key + folder inputs, test connection |
| `client/src/api/client.ts` | Modify | uploadFile() → direct imgbb, then POST metadata to backend |

## Interfaces / Contracts

### imgbbService.ts

```typescript
interface ImgbbResponse {
  id: string;
  url: string;           // full imgbb URL
  thumbnailUrl: string; // data.thumb.url
  deleteUrl: string;    // data.delete_url
}

class ImgbbService {
  constructor(apiKey: string, folder?: string);
  upload(buffer: Buffer, fileName: string, mimeType: string): Promise<ImgbbResponse>;
  uploadFromUrl(url: string, fileName?: string): Promise<ImgbbResponse>;
}
```

### storageService.ts

```typescript
interface StorageService {
  upload(buffer: Buffer, fileName: string, mimeType: string): Promise<{ url: string; thumbnailUrl: string }>;
  url(key: string): string;
  delete?(key: string): Promise<void>;
}

function createStorageService(): StorageService; // returns imgbb implementation
```

### UploadItem type (shared/types.ts)

```typescript
export interface UploadItem {
  id: number;
  fileName: string;      // rhFileName on disk (local uploads) or imgbb key
  rhFileName?: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  imgbbUrl?: string;     // NEW: primary display URL
  imgbbThumbnailUrl?: string; // NEW: thumbnail URL
}
```

### POST /api/upload contract change

- **Before**: multipart/form-data → save to `uploads/` → upload to RH → return `{ fileName, rhFileName }`
- **After (direct imgbb flow)**: body `{ imgbbUrl, imgbbThumbnailUrl, originalName, mimeType }` → insert uploads record → return `{ fileName, imgbbUrl, imgbbThumbnailUrl }`

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | imgbbService encoding/response mapping | Mock fetch, assert correct base64 payload and response mapping |
| Unit | storageService factory returns correct impl | Assert createStorageService() returns imgbb-backed impl |
| Unit | galleryStore saves imgbb URL not local path | Mock imgbbService, assert INSERT uses imgbb URL |
| Integration | upload endpoint metadata path | POST with imgbb metadata, assert DB record has imgbbUrl |
| Integration | gallery redirect for imgbb records | GET /api/gallery/files/:id → assert 302 to imgbb domain |
| Integration | legacy local path fallback | GET /api/gallery/files/:id for old record → serve from local |
| E2E | Full upload-to-display flow | UploadGallery → imgbb → API → gallery display |

## Migration / Rollout

**No phased rollout needed.** New records use imgbb immediately. Legacy records with local `fileName` (paths like `abc123.png`) are detected by checking if `fileName` starts with `http`. The serve functions handle both:

- `fileName.startsWith('http')` → treat as imgbb URL, redirect
- Otherwise → serve from local `uploads/` or `downloads/` (fallback)

This avoids a blanket migration of existing records. Existing local files remain accessible.

**Database migration:** Two ALTER TABLE statements for `uploads` (imgbbUrl, imgbbThumbnailUrl). No changes to `gallery_items` schema.

## Open Questions

- [ ] Should we delete the local `uploads/` and `downloads/` folders after migration is confirmed stable? This would free space but break legacy record serving.
- [ ] imgbb free tier has limits (1000 uploads/day, 100MB/file). Should we add a cleanup job to remove uploads older than X days from imgbb?
- [ ] Does the imgbb delete URL actually work? If so, should we call it on gallery item soft-delete to save costs?