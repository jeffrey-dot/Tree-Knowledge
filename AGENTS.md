# AGENTS.md

This repository defines and will implement a desktop product named **Tree Knowledge**: a tree-shaped LLM knowledge base and context management system.

The product exists to solve a specific problem: linear LLM chats make context hard to find, pollute the main thread with temporary questions, and blur unrelated branches of thought. In this system, context is a tree, not a line.

## Current Repository State

- The repository is documentation-first at this stage.
- There is no application scaffold yet.
- Product and architecture decisions live in `docs/`.
- When implementation begins, keep this file aligned with the actual codebase.

## Non-Negotiable Product Rules

These rules are more important than implementation convenience:

1. Context is organized as a tree.
2. Each node represents an independent semantic context.
3. A conversation at the current node may inherit only:
   - root node context,
   - parent-chain context,
   - current node context.
4. A node must not automatically read sibling nodes, uncle nodes, archived nodes, or unrelated branches.
5. Temporary questions should become child branches instead of polluting the current main line.
6. Users can continue a conversation from any node.
7. Users can create a new branch from any message.
8. Every node maintains a summary for fast LLM context reconstruction.
9. Node rename, archive, delete, and merge are first-class operations.
10. Search can cover current node, parent chain, and global knowledge, but ranking must prefer current node and parent chain by default.
11. When a node task appears complete, the system may suggest next nodes, but must not automatically jump or mutate the tree.
12. Users must be able to see all nodes visually. Do not model the primary UI as folders.

## Product Defaults

- Product shape: desktop app.
- Target user: individual knowledge worker.
- First implementation stack: Tauri + React + SQLite.
- Data model: local-first.
- LLM integration: built-in OpenAI-compatible chat and embedding APIs.
- Primary UI: zoomable tree canvas plus node detail/conversation panel.
- Web knowledge: explicit user-triggered web search/fetch. Results do not enter durable context unless the user confirms.
- MVP priority: tree-shaped context correctness before advanced web research or visual polish.

## Documentation Map

- `README.md`: product overview and repository entry point.
- `docs/product-spec.md`: product goals, concepts, MVP scope, and non-goals.
- `docs/context-rules.md`: context isolation, retrieval precedence, summaries, branching, merge, archive, and delete rules.
- `docs/architecture.md`: proposed technical architecture, storage model, services, and main flows.
- `docs/mvp-roadmap.md`: implementation milestones and acceptance criteria.
- `DESIGN.md`: frontend visual system and interaction guidance for the Tree Knowledge desktop workspace.

## Engineering Principles

- Preserve the context isolation model before adding convenience features.
- Prefer explicit user actions over automatic cross-branch behavior.
- Keep local data ownership clear. Do not add cloud sync, accounts, or team collaboration unless explicitly requested.
- Make every LLM context bundle inspectable by the user.
- Treat summaries as cached derived state, not the only source of truth.
- Keep node operations reversible where practical, especially archive and merge.
- Add abstractions only when they protect product invariants or reduce real duplication.

## Implementation Guidance For Future Agents

Before writing code:

1. Read this file.
2. Read `docs/context-rules.md`.
3. Read the relevant section of `docs/architecture.md`.
4. If the change touches UI, read `DESIGN.md`.
5. State which product invariant the change touches.

When implementing context assembly:

- Build from explicit ancestry, not from graph neighborhood.
- Include sibling or global content only through explicit search results or user-selected references.
- Label every non-current-node source in the prompt/context preview.
- Keep retrieval ranking deterministic enough to test.

When implementing UI:

- The tree canvas is the primary navigation surface.
- Do not hide the product behind a folder/file explorer metaphor.
- Keep current node, parent chain, siblings, archived nodes, and merged sources visually distinguishable.
- Provide an action to inspect the exact context sent to the LLM.
- Use `DESIGN.md` as the source for visual tokens, component styling, tree canvas states, motion, and accessibility.
- Apply the design system as a desktop workbench, not as a marketing page: no default landing hero, no oversized workspace typography, and no decorative visuals that reduce information density.
- If `DESIGN.md` conflicts with product invariants, context rules, or long-session usability, the product/context rules win.
- Preserve `DESIGN.md`'s source badges and semantic colors for context provenance: current, parent, global, web, and excluded.

When implementing persistence:

- Store canonical messages and node metadata separately from generated summaries.
- Store merge/source provenance.
- Do not hard-delete complex user data without confirmation.
- Keep migrations explicit and documented.

When implementing web fetch/search:

- Treat web results as external sources.
- Show URL/title/fetch time.
- Do not add fetched text to node summaries or embeddings until the user confirms.
- Make failures visible without blocking local conversation.

## Review Checklist

Use this checklist for any product or code change:

- Does the current node still ignore sibling branches by default?
- Can the user inspect why a piece of context was included?
- Does temporary work branch instead of polluting the current node?
- Are summaries refreshable from source messages?
- Are destructive operations confirmed?
- Does the UI still make the whole tree visible and navigable?
- Does the change avoid adding accounts/cloud/team complexity to MVP?
