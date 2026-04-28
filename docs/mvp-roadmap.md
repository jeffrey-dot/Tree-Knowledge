# MVP Roadmap

## Milestone 1: Documentation And Project Skeleton

Deliver:

- stable product docs,
- Tauri + React scaffold,
- basic app shell,
- SQLite migration setup,
- domain type definitions.

Acceptance:

- app opens to the working surface,
- repository has documented setup commands,
- initial migrations create tree/node/node-content/summary tables.

## Milestone 2: Tree And Node Operations

Deliver:

- create knowledge tree,
- create child node,
- rename node,
- archive node,
- delete subtree with confirmation,
- switch active node,
- visual tree canvas with current-node and parent-chain highlighting.

Acceptance:

- user can see all nodes on a canvas,
- no folder-based navigation is required,
- current node and parent chain are visually obvious.

## Milestone 3: Scoped Generation And Context Assembly

Deliver:

- OpenAI-compatible model settings,
- node-scoped content generation,
- update generated content from the current node,
- deterministic context builder,
- context preview panel.

Acceptance:

- child node generation inherits root and parent-chain summaries,
- sibling node content is excluded by default,
- context preview shows included and excluded sources.

## Milestone 4: Summaries And Branching

Deliver:

- auto node summary generation,
- manual summary refresh,
- create branch from node,
- temporary question branch action.

Acceptance:

- summaries are regenerated from source data,
- branch created from a typed question records provenance,
- temporary question does not mutate the original node content.

## Milestone 5: Retrieval

Deliver:

- chunking and embeddings,
- scoped search for current node,
- parent-chain search,
- global search,
- ranking that prefers current node and ancestors.

Acceptance:

- global results are labeled,
- unrelated branch results do not enter context automatically,
- current-node and parent-chain hits rank ahead of global hits by default.

## Milestone 6: Merge, Completion, And Web Sources

Deliver:

- merge node into target node,
- merge provenance records,
- completion classifier,
- next-node suggestions,
- explicit URL fetch/web search,
- staged web source confirmation flow.

Acceptance:

- merge updates target summary and preserves source reference,
- completion suggestions do not mutate the tree without user confirmation,
- unconfirmed web results do not enter durable context.

## MVP Exit Criteria

The MVP is complete when:

- a user can manage a long-running project as a visible tree,
- any node can be reopened and refined with its own scoped context,
- the LLM context boundary is inspectable,
- sibling branches are excluded by default,
- useful side-branch results can be merged back deliberately,
- web results require explicit confirmation before becoming durable knowledge.
