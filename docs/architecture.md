# Architecture

## Stack

Recommended MVP stack:

- Tauri for desktop shell and local system access.
- React for the app UI.
- TypeScript for frontend and shared domain types.
- SQLite for local persistence.
- Rust Tauri commands for database, filesystem, and web fetch boundaries.
- OpenAI-compatible APIs for chat and embeddings.

The app is local-first. Cloud sync, accounts, and team collaboration are not part of MVP.

## High-Level Modules

### UI

Responsible for:

- tree canvas,
- node detail panel,
- context preview,
- search UI,
- web fetch/search UI,
- node operation dialogs.

The tree canvas is the primary navigation model. Do not replace it with a folder explorer.

### Domain Service

Responsible for:

- tree operations,
- node lifecycle,
- branch creation,
- merge behavior,
- context assembly,
- completion suggestion handling.

### LLM Service

Responsible for:

- OpenAI-compatible chat requests,
- embedding requests,
- summary generation,
- completion classification,
- prompt/context bundle construction.

### Retrieval Service

Responsible for:

- chunking node content and references,
- embedding storage,
- scoped search,
- rank ordering by current node and parent chain priority.

### Web Source Service

Responsible for:

- explicit URL fetch,
- explicit web search/fetch,
- text extraction,
- source metadata,
- staging results before user confirmation.

## Data Model

Initial TypeScript domain shape:

```ts
type KnowledgeTree = {
  id: string;
  title: string;
  rootNodeId: string;
  createdAt: string;
  updatedAt: string;
};

type ContextNode = {
  id: string;
  treeId: string;
  parentId: string | null;
  title: string;
  status: "active" | "done" | "archived" | "deleted";
  summary: string;
  userGoal: string | null;
  sortOrder: number;
  createdFromNodeId: string | null;
  sourcePrompt: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  deletedAt: string | null;
};

type NodeContent = {
  id: string;
  nodeId: string;
  content: string;
  version: number;
  createdAt: string;
};

type NodeSummary = {
  id: string;
  nodeId: string;
  summary: string;
  version: number;
  generatedFromContentVersion: number | null;
  createdAt: string;
};

type NodeMerge = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  mode: "summary-only" | "summary-and-key-content";
  createdAt: string;
};

type WebSource = {
  id: string;
  nodeId: string | null;
  url: string;
  title: string;
  extractedText: string;
  summary: string;
  status: "staged" | "confirmed" | "discarded";
  fetchedAt: string;
};

type VectorChunk = {
  id: string;
  ownerType: "node-content" | "node-summary" | "web-source";
  ownerId: string;
  nodeId: string | null;
  text: string;
  embedding: number[];
  createdAt: string;
};
```

## Core Interfaces

```ts
type ContextBuildOptions = {
  includeGlobal?: boolean;
  includeWeb?: boolean;
  selectedSourceIds?: string[];
};

type CompiledContext = {
  nodeId: string;
  sourceItems: Array<{
    type: "summary" | "node-content" | "retrieval-hit" | "web-source";
    ownerId: string;
    nodeId: string | null;
    label: string;
    content: string;
  }>;
  tokenEstimate: number;
};

async function buildContext(
  nodeId: string,
  options: ContextBuildOptions
): Promise<CompiledContext>;

async function createBranchFromNode(
  nodeId: string,
  title?: string
): Promise<ContextNode>;

async function mergeNode(
  sourceNodeId: string,
  targetNodeId: string,
  mode: "summary-only" | "summary-and-key-content"
): Promise<void>;

async function refreshNodeSummary(nodeId: string): Promise<NodeSummary>;

async function searchKnowledge(
  query: string,
  scope: "current" | "ancestor" | "global" | "web"
): Promise<SearchResult[]>;
```

## Main Runtime Flows

### Generate Or Update Node Content

1. User requests generation or refinement for the current node.
2. Build context using root, parent chain, current node, and explicit selected sources.
3. Show or store context preview metadata.
4. Send request to configured chat model.
5. Save generated node content as a new content version.
6. Refresh summary if needed.
7. Run completion classifier.
8. Show next-node suggestions if confidence is high.

### Create Temporary Branch

1. User clicks temporary question action.
2. Create child node under current node.
3. Optionally seed the new node goal from selected text or user input.
4. Switch to new node.
5. Keep original node unchanged.

### Create Branch From Selected Topic

1. User writes or selects a topic/reference.
2. Create child node under the current node.
3. Store the source node and optional source prompt.
4. Optionally copy the selected source as the new node's opening reference.
5. Generate or refine content inside the new node.

### Web Fetch/Search

1. User explicitly starts URL fetch or web search.
2. Fetch and extract page text.
3. Store result as staged source.
4. Show source card with URL, title, summary, and fetch time.
5. User confirms whether to attach it to current node.
6. Only confirmed sources are embedded and eligible for future retrieval.

## Storage Notes

- Use migrations from the first implementation.
- Keep summaries versioned.
- Keep merge provenance.
- Prefer soft delete for user data.
- Embeddings can be recomputed, so they should be treated as derived data.
- API keys should be stored through the platform credential store where possible; otherwise encrypt or clearly mark local storage behavior.
