export type NodeStatus = "active" | "done" | "archived";

export type NodeKind = "root" | "main" | "temporary" | "research" | "decision";

export type SourceScope = "current" | "parent" | "global" | "web" | "excluded";

export type TreeNode = {
  id: string;
  parentId: string | null;
  title: string;
  goal: string;
  summary: string;
  status: NodeStatus;
  kind: NodeKind;
  x: number;
  y: number;
  materials: number;
  references: number;
  webSources: number;
  merged: number;
};

export type NodeDetailMock = {
  content: string;
};

export type RetrievalHit = {
  id: string;
  title: string;
  excerpt: string;
  scope: SourceScope;
  nodeId?: string;
};

export type WebSource = {
  id: string;
  title: string;
  url: string;
  summary: string;
  status: "staged" | "confirmed";
  nodeId?: string;
};

export type CompletionSuggestion = {
  id: string;
  title: string;
  relation: "child" | "sibling" | "parent";
  rationale: string;
};

export type ContextSourceType =
  | "summary"
  | "content"
  | "retrieval-hit"
  | "excluded-branch";

export type ContextPreviewSource = {
  id: string;
  type: ContextSourceType;
  scope: SourceScope;
  title: string;
  content: string;
  reason: string;
  nodeId?: string;
};

export type CompiledContextPreview = {
  nodeId: string;
  includedItems: ContextPreviewSource[];
  excludedItems: ContextPreviewSource[];
  tokenEstimate: number;
};
