export enum Sender {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system'
}

export type ToolStatus = 'pending' | 'executed' | 'rejected';

export interface ToolCallData {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status?: ToolStatus;
  result?: string;
  userConfirmationRequired?: boolean;
}

export interface Message {
  id: string;
  sender: Sender;
  text?: string;
  image?: string;
  toolCalls?: ToolCallData[];
  timestamp: number;
  systemNote?: string;
}

export interface AnalysisState {
  isAnalyzing: boolean;
  statusMessage: string;
}

export interface GeminiToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface GeminiResponse {
  textResponse: string;
  toolCalls?: GeminiToolCall[];
}
