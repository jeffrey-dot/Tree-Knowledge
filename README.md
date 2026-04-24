# Tree Knowledge

Tree Knowledge is a desktop LLM knowledge base and context management system.

Its core idea is simple: **LLM context should be a tree, not a linear chat log**. Each node is an independent semantic context. A node can inherit only its root and parent-chain context, so temporary questions and side explorations do not pollute the main line of work.

## Product Direction

- Desktop app for individual knowledge workers.
- Local-first data storage.
- Built-in OpenAI-compatible LLM conversation.
- Visual tree canvas instead of folder-based navigation.
- Explicit branch creation from any node or message.
- Node summaries for fast context reconstruction.
- Search across current node, parent chain, and global knowledge, with local context preferred by default.
- Optional user-triggered web search/fetch, without automatic context pollution.

## Repository Status

This repository is currently in the planning/documentation stage. The implementation target is:

- Tauri for the desktop shell.
- React for UI.
- SQLite for local persistence.
- Local vector index or SQLite vector extension for retrieval.
- OpenAI-compatible chat and embedding APIs.

## Documents

- [AGENTS.md](./AGENTS.md): rules for future coding agents and maintainers.
- [Product Spec](./docs/product-spec.md): goals, user model, MVP scope, and non-goals.
- [Context Rules](./docs/context-rules.md): strict context inheritance and retrieval behavior.
- [Architecture](./docs/architecture.md): proposed data model, services, and runtime flows.
- [MVP Roadmap](./docs/mvp-roadmap.md): build milestones and acceptance criteria.

## Core Invariant

For any active node, the LLM may use only:

1. root node context,
2. parent-chain context,
3. current node context,
4. explicitly selected search/web/reference results.

Sibling branches and unrelated nodes must never be included automatically.
