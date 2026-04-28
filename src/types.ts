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
  content: string[];
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
