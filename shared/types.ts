export type FieldType = 'IMAGE' | 'AUDIO' | 'VIDEO' | 'FILE' | 'STRING' | 'LIST' | 'SWITCH' | 'LORA' | 'INT';
export type TaskStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';

export interface SavedPrompt {
  id: number;
  title: string;
  content: string;
  toolId: number | null;
  description: string;
  tags: string;
  createdAt: string;
  updatedAt: string;
}

export interface RhNodeField {
  nodeId: string;
  nodeName?: string;
  fieldName: string;
  fieldValue: string;
  fieldType?: FieldType;
  fieldData?: string;
  description?: string;
  descriptionEn?: string;
}

export interface RhAppDemo {
  webappName: string;
  nodeInfoList: RhNodeField[];
  tags?: { id: string; name: string; nameEn: string }[];
  covers?: { url: string; thumbnailUri: string }[];
  accessEncrypted: boolean;
  statisticsInfo?: { likeCount: string; useCount: string; collectCount: string };
}

export interface Tool {
  id: number;
  webappId: string;
  webappName: string;
  coverUrl?: string;
  nodeInfoList: string;
  tags: string;
  createdAt: string;
  updatedAt: string;
  taskCount?: number;
}

export interface Task {
  id: number;
  taskId: string;
  toolId: number;
  toolName?: string;
  status: TaskStatus;
  nodeInfoList: string;
  resultFiles: string;
  errorMessage?: string;
  failedReason?: string;
  pollCount: number;
  lastPolledAt?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  resultCount?: number;
}

export interface ResultFile {
  nodeId: string;
  filePath: string;
  fileName: string;
  mimeType: string;
}

export interface UploadItem {
  id: number;
  fileName: string;
  rhFileName?: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  imgbbUrl?: string;          // Primary display URL after direct browser upload
  imgbbThumbnailUrl?: string; // Thumbnail URL from imgbb
}

/**
 * GalleryItem.fileName — post-migration this column stores the imgbb CDN URL.
 * For legacy records it may still contain a local path (downloads/...) which is
 * detected by checking whether the value starts with "http".
 */
