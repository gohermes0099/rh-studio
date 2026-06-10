export {};
/**
 * GalleryItem.fileName — post-migration this column stores the imgbb CDN URL.
 * For legacy records it may still contain a local path (downloads/...) which is
 * detected by checking whether the value starts with "http".
 */
