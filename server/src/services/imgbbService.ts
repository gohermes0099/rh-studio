/**
 * imgbbService — wraps the imgbb.com upload API.
 *
 * Imgbb supports CORS, so the client can POST directly.
 * This server-side service is used for auto-uploading RH task results.
 */

const IMGBB_BASE = 'https://api.imgbb.com/1/upload';
const TIMEOUT_MS = 30_000;

export interface ImgbbResult {
  url: string;          // full imgbb URL
  thumbnailUrl: string; // data.thumb.url
  deleteUrl: string;    // data.delete_url
}

export interface ImgbbServiceOptions {
  apiKey: string;
  folder?: string; // optional sub-folder prefix (not used in API, kept for future)
}

export class ImgbbService {
  private apiKey: string;

  constructor(apiKey: string, _folder?: string) {
    this.apiKey = apiKey;
  }

  /**
   * Upload a image buffer to imgbb.
   */
  async upload(buffer: Buffer, fileName: string, mimeType: string): Promise<ImgbbResult> {
    const base64 = buffer.toString('base64');
    const formBody = new URLSearchParams({
      key: this.apiKey,
      image: base64,
      name: fileName,
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(IMGBB_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody.toString(),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      let detail = '';
      try {
        const body = await res.json();
        detail = JSON.stringify(body);
      } catch { /* ignore */ }
      throw new Error(`imgbb upload failed: ${res.status} ${detail}`);
    }

    const body = await res.json() as { data?: { url?: string; thumb?: { url?: string }; delete_url?: string }; status?: number; error?: { message?: string } };

    if (body.error?.message) {
      throw new Error(`imgbb error: ${body.error.message}`);
    }

    const data = body.data;
    if (!data?.url || !data?.thumb?.url || !data?.delete_url) {
      throw new Error(`imgbb response missing required fields: ${JSON.stringify(body)}`);
    }

    return {
      url: data.url,
      thumbnailUrl: data.thumb.url,
      deleteUrl: data.delete_url,
    };
  }

  /**
   * Fetch a remote image and re-upload it to imgbb.
   * Used for RH result URLs — the server fetches the image then uploads to imgbb.
   */
  async uploadFromUrl(url: string, fileName?: string): Promise<ImgbbResult> {
    const fetched = await fetch(url);
    if (!fetched.ok) {
      throw new Error(`fetch for imgbb re-upload failed: ${fetched.status} ${url}`);
    }

    const buffer = Buffer.from(await fetched.arrayBuffer());
    const name = fileName ?? url.split('/').pop()?.split('?')[0] ?? 'upload';
    const contentType = fetched.headers.get('content-type') ?? 'image/png';

    return this.upload(buffer, name, contentType);
  }
}