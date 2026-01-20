export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  timestamp: Date;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tool?: string;
  timestamp: Date;
  files?: UploadedFile[];
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: 'uploading' | 'completed' | 'error';
  progress: number;
  blobUrl?: string;
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: any;
}