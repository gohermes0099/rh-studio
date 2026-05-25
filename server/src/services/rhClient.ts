import type { RhAppDemo, RhNodeField } from '../../../shared/types.js';

export class RhClient {
  private apiKey: string;
  private baseUrl = 'https://www.runninghub.ai';
  private timeout = 120_000;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async fetchSchema(webappId: string): Promise<RhAppDemo> {
    const url = `${this.baseUrl}/api/webapp/apiCallDemo?apiKey=${encodeURIComponent(this.apiKey)}&webappId=${encodeURIComponent(webappId)}`;
    const res = await this.fetchWithTimeout(url, { method: 'GET' });
    const body = await res.json();
    if (!res.ok) {
      throw new Error(`fetchSchema failed: ${res.status} ${JSON.stringify(body)}`);
    }
    return body.data ?? body;
  }

  async runTask(
    webappId: string,
    nodeInfoList: RhNodeField[],
    options?: { instanceType?: string; usePersonalQueue?: boolean },
  ): Promise<{ taskId: string; status: string }> {
    const url = `${this.baseUrl}/openapi/v2/run/ai-app/${webappId}`;
    const payload: Record<string, unknown> = { nodeInfoList };
    if (options?.instanceType) payload.instanceType = options.instanceType;
    if (options?.usePersonalQueue !== undefined) payload.usePersonalQueue = options.usePersonalQueue;

    const res = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const body = await res.json();
    if (!res.ok || body.code !== 0) {
      throw new Error(`runTask failed: ${res.status} ${JSON.stringify(body)}`);
    }
    return { taskId: body.data.taskId, status: body.data.status };
  }

  async queryTask(taskId: string): Promise<{
    status: string;
    results?: { url: string; nodeId: string; outputType: string }[];
    errorMessage?: string;
    failedReason?: unknown;
  }> {
    const url = `${this.baseUrl}/openapi/v2/query`;
    const res = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ taskId }),
    });

    const body = await res.json();
    if (!res.ok || body.code !== 0) {
      throw new Error(`queryTask failed: ${res.status} ${JSON.stringify(body)}`);
    }
    return {
      status: body.data.status,
      results: body.data.results,
      errorMessage: body.data.errorMessage,
      failedReason: body.data.failedReason,
    };
  }

  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
  ): Promise<{ download_url: string; fileName: string }> {
    const url = `${this.baseUrl}/openapi/v2/media/upload/binary`;
    const formData = new FormData();
    const blob = new Blob([fileBuffer]);
    formData.append('file', blob, fileName);

    const res = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
      body: formData,
    });

    const body = await res.json();
    if (!res.ok || body.code !== 0) {
      throw new Error(`uploadFile failed: ${res.status} ${JSON.stringify(body)}`);
    }
    return body.data;
  }

  private async fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      return res;
    } finally {
      clearTimeout(timer);
    }
  }
}
