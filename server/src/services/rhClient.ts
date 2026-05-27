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
    // V2 endpoint returns task data directly; V1 wraps in { code, data, msg }
    // V2: { taskId, status, errorCode, errorMessage }
    // V1: { code: 0, data: { taskId, taskStatus }, msg: "success" }
    if (body.errorCode && body.errorCode !== '') {
      throw new Error(`runTask failed: ${res.status} ${JSON.stringify(body)}`);
    }
    if (body.code !== undefined && body.code !== 0) {
      throw new Error(`runTask failed: ${res.status} ${JSON.stringify(body)}`);
    }
    if (body.taskId) {
      return { taskId: body.taskId, status: body.status || 'PENDING' };
    }
    if (body.data?.taskId) {
      return { taskId: body.data.taskId, status: body.data.taskStatus || 'PENDING' };
    }
    throw new Error(`runTask failed: unexpected response ${JSON.stringify(body)}`);
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
    if (!res.ok) {
      throw new Error(`queryTask failed: ${res.status} ${JSON.stringify(body)}`);
    }
    // V2 endpoint returns { taskId, status, results, ... }
    // V1 endpoint wraps in { code, data: { taskId, taskStatus, results, ... } }
    if (body.code !== undefined && body.code !== 0) {
      throw new Error(`queryTask failed: ${res.status} ${JSON.stringify(body)}`);
    }
    const d = body.data ?? body;
    return {
      status: d.status ?? d.taskStatus ?? 'UNKNOWN',
      results: d.results ?? undefined,
      errorMessage: d.errorMessage ?? undefined,
      failedReason: d.failedReason ?? undefined,
    };
  }

  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
  ): Promise<{ download_url: string; fileName: string }> {
    const url = `${this.baseUrl}/openapi/v2/media/upload/binary`;
    const formData = new FormData();
    const blob = new Blob([fileBuffer as BlobPart]);
    formData.append('file', blob, fileName);

    const res = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
      body: formData,
    });

    const body = await res.json();
    if (!res.ok) {
      throw new Error(`uploadFile failed: ${res.status} ${JSON.stringify(body)}`);
    }
    // V2 may return { code, data } or flat { fileName, download_url }
    if (body.code !== undefined && body.code !== 0) {
      throw new Error(`uploadFile failed: ${res.status} ${JSON.stringify(body)}`);
    }
    if (body.data?.fileName) return body.data;
    if (body.fileName) return body;
    throw new Error(`uploadFile failed: unexpected response ${JSON.stringify(body)}`);
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
