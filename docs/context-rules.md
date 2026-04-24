# Context Rules

## Core Invariant

For a current node `N`, automatic context is limited to:

1. the root node,
2. the parent chain from root to `N`,
3. node `N` itself.

No sibling node, uncle node, cousin node, archived node, or unrelated branch may be included automatically.

## Context Assembly Order

When sending a message from a current node, assemble context in this order:

1. system rules,
2. root node summary,
3. parent-chain summaries from root to direct parent,
4. current node summary,
5. recent current-node messages,
6. retrieval results from current node,
7. retrieval results from parent chain,
8. explicitly selected global or web results.

Every included item should carry source metadata so the user can inspect why it was included.

## Retrieval Scope

Supported scopes:

- `current`: messages, summary, references, and chunks owned by the current node.
- `ancestor`: parent-chain nodes only.
- `global`: all non-deleted nodes and confirmed sources.
- `web`: explicit web fetch/search results.

Default ranking priority:

1. current node,
2. direct parent,
3. older ancestors toward root,
4. confirmed current-node references,
5. global knowledge,
6. web results.

Global and web results must be clearly labeled and should not appear in context unless the user enables them or selects them.

## Branching Rules

Create a child branch when:

- the user asks a temporary question,
- the user explores an alternative,
- the topic diverges from the current task,
- the user creates a branch from a message,
- the assistant recommends splitting a thread.

Branch creation from a message must record `createdFromMessageId`. The new branch starts with inherited parent-chain summaries but owns its future messages independently.

## Summary Rules

Each node summary should include:

- node goal,
- durable facts,
- decisions made,
- important outputs,
- open questions,
- references worth keeping,
- suggested next steps when relevant.

Summaries are derived state:

- They can be regenerated from messages and references.
- They must not be the only source of truth.
- They should not silently include sibling-branch content.
- They should not include unconfirmed web results.

Summary refresh triggers:

- after a meaningful assistant response,
- after merge,
- after user edits the node goal/title,
- after confirmed web/reference import,
- when the user manually refreshes.

## Merge Rules

Node merge is explicit and provenance-preserving.

Supported MVP merge modes:

- `summary-only`: append a generated merge note from the source node into the target node.
- `summary-and-key-messages`: also copy selected source messages into the target as referenced imported messages.

After merge:

- the target node records the source node ID and merge time,
- source content remains inspectable,
- source node may be archived but is not automatically deleted,
- target summary is refreshed.

## Archive And Delete Rules

Archive:

- removes a node from default active navigation emphasis,
- keeps it searchable when global search is enabled,
- excludes it from automatic context unless it is still in the current parent chain, which should be prevented by requiring descendants to move or archive together.

Delete:

- requires confirmation,
- deletes a whole subtree in MVP,
- should be soft-delete internally if implementation cost is acceptable,
- must remove deleted nodes from default search and context.

## Completion Suggestions

After assistant responses, the system may classify node progress:

```ts
type NodeCompletionSignal = {
  isDone: boolean;
  confidence: number;
  reason: string;
  suggestedNextNodes: Array<{
    title: string;
    relation: "child" | "sibling" | "parent";
    rationale: string;
  }>;
};
```

Completion suggestions are advisory only:

- do not auto-create nodes,
- do not auto-switch nodes,
- do not archive nodes automatically,
- ask for user confirmation before mutation.

## Context Preview

Before or after each send, the user must be able to inspect:

- summaries included,
- messages included,
- retrieval hits included,
- web/global sources included,
- token estimate,
- excluded branch categories.

This preview is a core trust feature, not a debugging-only feature.
