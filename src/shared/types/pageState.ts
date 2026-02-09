// ─── Page State Types ───────────────────────────────────────

export type ExtractionMethod = 'accessibility-tree' | 'simplified-dom';

export interface PageState {
  url: string;
  title: string;
  extractionMethod: ExtractionMethod;
  timestamp: number;
  axTree?: AXTree;
  simplifiedDOM?: SimplifiedDOM;
}

export interface SanitizedPageState extends PageState {
  sanitized: true;
  sanitizationMetadata?: {
    removedElements: number;
    truncatedFields: number;
    suspiciousContentDetected: boolean;
    sanitizedAt: number;
  };
}

export interface Landmark {
  role: string;
  name: string;
}

export interface InteractiveElement {
  id: string;
  role: string;
  name: string;
  value?: string;
  selector: string;
  states: string[];
}

export interface Heading {
  level: number;
  text: string;
}

// ─── Accessibility Tree Types ───────────────────────────────

export interface AXTree {
  nodes: AXNode[];
}

export interface AXNode {
  nodeId: string;
  role: string;
  name: string;
  value?: any;
  description?: string;
  properties?: Record<string, any>;
  childIds: string[];
}

// ─── Simplified DOM Types ───────────────────────────────────

export interface SimplifiedDOM {
  elements: DOMElement[];
  extractedAt: number;
}

export interface DOMElement {
  id: string;
  tagName: string;
  role: string;
  name: string;
  value?: string;
  selector: string;
  attributes?: Record<string, any>;
}

// ─── Navigation Types ───────────────────────────────────────

export interface NavigationEntry {
  url: string;
  title: string;
  timestamp: string;
}
