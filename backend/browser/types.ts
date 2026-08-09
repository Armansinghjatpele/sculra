// ==============================================================================
// Browser Engine Type Definitions (backend/browser/types.ts)
// ==============================================================================

export interface ViewportSize {
  width: number;
  height: number;
}

export interface NetworkRequest {
  url: string;
  method: string;
  status: number;
  headers: Record<string, string>;
  responseSize: number;
}

export interface ConsoleLog {
  type: 'log' | 'info' | 'warn' | 'error';
  text: string;
  timestamp: string;
}

export interface DOMElement {
  selector: string;
  tagName: string;
  innerText?: string;
  isInteractable: boolean;
}
