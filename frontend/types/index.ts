export type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tool?: string;
  timestamp: Date;
};

export type Tool = {
  name: string;
  description: string;
  inputSchema: any;
};