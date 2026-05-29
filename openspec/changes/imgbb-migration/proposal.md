# Proposal: imgbb-migration

## Intent

Migrate all image storage from local filesystem (`uploads/` + `downloads/`) to imgbb. This enables deploying the frontend and backend on Netlify (no local filesystem dependency) while using Supabase PostgreSQL for relational data. imgbb handles all image hosting; RunningHub continues to be used for AI generation.

## Scope

### In Scope
- Create `StorageService` interface abstracting local vs. imgbb backends
- Create `imgbbService.ts` wrapping the imgbb API (client uploads directly)
- Create `uploadGalleryService.ts` for server-side gallery result uploads to imgbb
- Update `upload.ts`, `uploads.ts`, `galleryStore.ts`, `tasks.ts`, `gallery.ts` routes
- Update `UploadGallery.tsx` and `Settings.tsx` to use imgbb URLs
- Update `client.ts` API client and `shared/types.ts`
- Update database migrations for any schema changes

### Out of Scope
- Netlify deployment configuration
- Supabase project setup
- Authentication/login system

## Capabilities

### New Capabilities
- `image-storage-abstraction`: StorageService interface allowing pluggable backends (local filesystem or imgbb)
- `imgbb-image-upload`: Direct client-to-imgbb upload flow using imgbb API key from localStorage
- `imgbb-gallery-upload`: Server-side upload of RunningHub result images to imgbb after task completion

### Modified Capabilities
- `file-management` (from scaffold-app FR-08): Remove local `uploads/` and `downloads/` dependencies; all image URLs now point to imgbb CDN

## Approach

**Hybrid with storage abstraction:**

1. **StorageService interface** — `server/src/services/storageService.ts` defines `upload(file): Promise<string>` and `url(key): string`. Initial implementation delegates to imgbb.

2. **Client direct-to-imgbb uploads** — `UploadGallery.tsx` uploads user-selected images directly to imgbb using the API key from localStorage. Backend is NOT in the upload path for user images.

3. **Server gallery uploads** — After RunningHub task completes, `galleryStore.ts` uploads result images to imgbb via `imgbbService.ts`. imgbb URL stored in `gallery_items` table.

4. **Database** — `gallery_items.fileName` stores the imgbb URL instead of local file path.

5. **Removed** — `GET /api/download/:taskId/:nodeId` route becomes unnecessary (imgbb serves images directly).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `server/src/services/storageService.ts` | New | StorageService interface |
| `server/src/services/imgbbService.ts` | New | imgbb API wrapper |
| `server/src/routes/upload.ts` | Modified | Remove local file handling |
| `server/src/routes/uploads.ts` | Modified | Serve uploads from imgbb URLs |
| `server/src/routes/gallery.ts` | Modified | Return imgbb URLs |
| `server/src/routes/tasks.ts` | Modified | Upload results to imgbb on completion |
| `server/src/services/galleryStore.ts` | Modified | Upload to imgbb after RH completion |
| `server/src/db/migrations.ts` | Modified | Schema updates if needed |
| `client/src/pages/UploadGallery.tsx` | Modified | Direct imgbb uploads from browser |
| `client/src/pages/Settings.tsx` | Modified | imgbb API key setting |
| `client/src/api/client.ts` | Modified | API client updates |
| `shared/types.ts` | Modified | Type updates |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| imgbb API key exposed in frontend | Low | Acceptable for personal use; key stored in localStorage only |
| CORS issues on direct imgbb uploads | Medium | Configure imgbb CORS whitelist for Netlify domain |
| imgbb upload failures leave orphaned state | Medium | Retry logic with user-facing error messages |
| Breaking API changes for existing gallery items | Low | imgbb URLs are permanent; old local paths handled gracefully |

## Rollback Plan

1. Revert `storageService.ts` to use local filesystem implementation
2. Update `galleryStore.ts` to save local file paths instead of imgbb URLs
3. Restore `GET /api/download/:taskId/:nodeId` route
4. Rollback database migration if schema changed (add down migration)
5. Revert client to use backend upload endpoint instead of direct imgbb

## Dependencies

- imgbb account and API key
- Netlify deployment domain (for CORS whitelist)
- User configures imgbb API key in Settings UI

## Success Criteria

- [ ] User images upload directly from browser to imgbb
- [ ] Gallery results from RunningHub are uploaded to imgbb automatically
- [ ] All image URLs in the app point to imgbb CDN
- [ ] No local filesystem reads/writes for images after migration
- [ ] App functions correctly on Netlify (no `uploads/` or `downloads/` folders)
- [ ] Existing gallery items (pre-migration) still display correctly via old local paths
