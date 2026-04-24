# Product Spec

## Summary

Tree Knowledge is a local-first desktop app for managing LLM conversations and knowledge as a visible tree of contexts.

The product solves three recurring failures in web-based LLM chat:

- Important context becomes hard to find in long linear threads.
- Temporary questions pollute the main conversation.
- Unrelated work gets mixed into one context window and degrades future answers.

Tree Knowledge replaces the linear chat mental model with a tree: each node is a scoped semantic context, and each branch represents a deliberate direction of thought.

## Target User

The first version is for individual knowledge workers:

- researchers,
- writers,
- developers,
- students,
- analysts,
- people who use LLMs for long-running projects.

Team collaboration, permissioning, and cloud sync are outside MVP scope.

## Core Concepts

### Knowledge Tree

A top-level project or knowledge workspace. It has one root node and many child nodes.

### Context Node

A node is an independent semantic context. It may represent:

- a task,
- a question,
- a subproblem,
- a temporary exploration,
- a research direction,
- a decision branch.

Each node owns its messages, summary, status, references, and retrieval chunks.

### Parent Chain

The path from the root node to the current node. This is the only inherited context path.

### Branch

A child node created from a node or a specific message. Branching is the default way to handle temporary or divergent work.

### Node Summary

A compact generated summary of the node's intent, facts, decisions, open questions, and important outputs. Summaries are used to reconstruct LLM context efficiently but must remain derived from source data.

### Global Knowledge

Searchable knowledge across all nodes and confirmed external sources. It may be searched, but it is not automatically included in the current context.

## MVP Capabilities

The MVP must support:

- create a knowledge tree,
- create, rename, archive, delete, and merge nodes,
- continue a conversation from any node,
- create a child branch from any node,
- create a branch from any message,
- auto-generate and manually refresh node summaries,
- search current node, parent chain, and global knowledge,
- inspect the exact context sent to the LLM,
- explicitly trigger web search/fetch,
- confirm web results before adding them to durable node knowledge,
- detect likely task completion and suggest next node actions.

## UX Requirements

- The first screen should be the working tree, not a marketing or folder-style landing view.
- Users should see all nodes visually on a zoomable canvas.
- The current node and its parent chain should be visually clear.
- Sibling nodes should be visible but clearly outside the active context.
- Temporary questions should be easy to create as child branches.
- Context boundaries should be explainable and inspectable.

## Non-Goals For MVP

- Cloud sync.
- Team workspaces.
- Multi-user permissions.
- Real-time collaboration.
- Mobile apps.
- Browser extension integration.
- Full document management.
- Automatic cross-branch context blending.
- Fully autonomous agent workflows.

## Success Criteria

The first version is successful when a user can run a long project with multiple branches and always answer:

- Where am I in the knowledge tree?
- What context will the LLM see?
- Which branch owns this temporary question?
- How do I continue from any previous node?
- How do I merge useful results back into the main line?
