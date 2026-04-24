# Tree Knowledge Design System

This document defines how Tree Knowledge should look and behave as a desktop knowledge workbench. It is inspired by Clay's warm, tactile, colorful style, but it is adapted for a dense product UI with a tree canvas, LLM conversation, search, and context inspection.

Use this file for frontend implementation. Use `AGENTS.md` and `docs/context-rules.md` for product invariants.

## 1. Design Intent

Tree Knowledge should feel:

- warm, clear, and crafted,
- visual enough to make the tree structure obvious,
- calm enough for long writing and research sessions,
- playful in small interactions, not theatrical,
- explicit about context boundaries and source provenance.

This is not a landing page design system. Do not build a marketing hero as the default screen. The first screen is the usable tree workspace.

## 2. Product-Specific Priorities

The UI must help users answer these questions at a glance:

- Which node am I in?
- Which parent chain is active?
- Which branches are visible but excluded from context?
- What exactly will be sent to the LLM?
- Which sources came from current node, ancestors, global search, or web fetch?

Visual style serves these priorities. If a Clay-inspired detail makes context boundaries less clear, skip the detail.

## 3. Color Tokens

Use warm neutrals as the base and swatches as meaningful accents. Do not let the app become a single-color theme.

```css
:root {
  --color-bg: #faf9f7;
  --color-surface: #ffffff;
  --color-text: #000000;
  --color-text-muted: #55534e;
  --color-text-subtle: #9f9b93;

  --color-border: #dad4c8;
  --color-border-light: #eee9df;
  --color-focus: #146ef5;

  --color-matcha-300: #84e7a5;
  --color-matcha-600: #078a52;
  --color-matcha-800: #02492a;

  --color-slushie-500: #3bd3fd;
  --color-slushie-800: #0089ad;

  --color-lemon-400: #f8cc65;
  --color-lemon-500: #fbbd41;

  --color-ube-300: #c1b0ff;
  --color-ube-800: #43089f;

  --color-pomegranate-400: #fc7981;
  --color-blueberry-800: #01418d;

  --shadow-clay: rgba(0, 0, 0, 0.10) 0 1px 1px,
    rgba(0, 0, 0, 0.04) 0 -1px 1px inset,
    rgba(0, 0, 0, 0.05) 0 -0.5px 1px;
  --shadow-hard: rgb(0, 0, 0) -4px 4px 0;

  --radius-node: 8px;
  --radius-card: 8px;
  --radius-panel: 12px;
  --radius-pill: 999px;
}
```

### Semantic Color Use

- Current node: white surface, black text, strong oat border, subtle clay shadow.
- Active parent chain: Lemon or Matcha accent line.
- Temporary branch: dashed oat border with Slushie accent.
- Archived node: muted text, light border, reduced opacity.
- Done node: Matcha accent.
- Conflict or destructive action: Pomegranate accent.
- Web source: Ube accent.
- Global search result: Blueberry accent.

## 4. Typography

Preferred fonts:

- Primary: Roobert, Inter, Arial, sans-serif.
- Monospace: Space Mono, ui-monospace, SFMono-Regular, monospace.

If Roobert is not available locally or licensed in the app, use Inter or system sans. Do not block implementation on the font.

Letter spacing is `0` by default. Do not use negative letter spacing in the app UI.

| Role | Size | Weight | Line Height | Use |
| --- | ---: | ---: | ---: | --- |
| App title | 24px | 600 | 1.2 | Workspace title, root title |
| Panel heading | 18px | 600 | 1.3 | Side panels, dialogs |
| Node title | 14px | 600 | 1.25 | Tree nodes |
| Body | 14px | 400 | 1.5 | Messages, summaries |
| UI label | 12px | 600 | 1.3 | Scope labels, tabs |
| Metadata | 12px | 400 | 1.4 | timestamps, source info |
| Code/source | 13px | 400 | 1.5 | prompt preview, snippets |

Use uppercase labels sparingly for scope markers such as `CURRENT`, `PARENT`, `GLOBAL`, and `WEB`.

## 5. Layout

Desktop workspace layout:

- Top bar: tree selector, search, model status, settings.
- Main canvas: full-height tree graph.
- Right panel: current node details, summary, conversation, references.
- Bottom or overlay panel: context preview when opened.

Default proportions:

- Top bar: 48px to 56px.
- Right panel: 380px to 480px, resizable.
- Canvas: remaining space.
- Context preview: modal or bottom sheet with scrollable source list.

Do not use nested cards. Use panels for major regions and cards only for repeated items such as nodes, search results, and source records.

## 6. Tree Canvas

The tree canvas is the primary product surface.

Required visual states:

- Current node is clearly selected.
- Parent chain is highlighted as a continuous path.
- Sibling and unrelated branches remain visible but visually secondary.
- Archived nodes are visible only when archive visibility is enabled.
- Nodes with unconfirmed web sources show a small pending-source indicator.

Node sizing:

- Compact node: 180px wide, 72px minimum height.
- Expanded node: 240px wide, up to 160px height.
- Preserve stable dimensions so hover states and status labels do not shift layout.

Node anatomy:

- Title.
- Short summary excerpt or goal.
- Status indicator.
- Source badges: message count, references, web, merged.
- Branch action button using an icon.

Connection lines:

- Default branch line: `#dad4c8`.
- Active parent chain: `#fbbd41` or `#078a52`, 2px.
- Temporary branch: dashed line.
- Merge provenance: dotted line or source badge, not a normal parent edge.

## 7. Core Components

### Buttons

Use icon buttons for common tools: branch, merge, archive, delete, search, inspect context, refresh summary, settings. Use lucide icons when available.

Button styles:

- Primary action: white background, black text, oat border, 8px radius.
- Secondary action: transparent background, oat border.
- Destructive action: Pomegranate border or background.
- Icon button: 32px square, 8px radius.

Hover:

- Use a small tactile motion: `translateY(-1px) rotate(-1deg)`.
- Use hard shadow only on primary or playful actions.
- Do not use large jumps such as `translateY(-80%)`.

Focus:

- Always show a `2px` focus ring in `--color-focus`.

### Panels

Panels are the main workspace regions. They may use:

- warm cream or white background,
- 1px oat border,
- 12px radius where framed,
- no heavy shadow unless floating above canvas.

Right panel sections:

- Node header.
- Summary.
- Conversation.
- References.
- Retrieval scope.
- Completion suggestions.

### Cards

Cards are for repeated items:

- tree nodes,
- search results,
- web source records,
- merge records,
- completion suggestions.

Use 8px radius, oat border, and restrained shadow. Avoid large decorative cards in the main workspace.

### Inputs

Inputs should be quiet and efficient:

- white background,
- oat or dark warm border,
- 8px radius,
- 14px text,
- clear focus ring.

The message composer should support:

- multiline input,
- send button,
- temporary branch action,
- web/search toggle,
- context preview action.

## 8. Context And Source UI

Context preview is a trust feature and must be easy to inspect.

Show included context grouped by:

- system rules,
- root summary,
- parent-chain summaries,
- current node summary,
- current node messages,
- current node retrieval,
- parent-chain retrieval,
- selected global results,
- selected web results.

Use source badges:

- `CURRENT`: Matcha.
- `PARENT`: Lemon.
- `GLOBAL`: Blueberry.
- `WEB`: Ube.
- `EXCLUDED`: warm muted.

For excluded content, show categories rather than full unrelated data:

- sibling branches excluded,
- archived nodes excluded,
- unconfirmed web results excluded.

## 9. Web Source UI

Web results are staged before confirmation.

Staged web source card:

- Ube accent.
- URL and title.
- fetch time.
- short extracted summary.
- actions: attach to current node, discard, open source.

Confirmed source card:

- shows attached node,
- can be included in retrieval,
- can be cited in context preview.

Unconfirmed web results must not look like durable knowledge.

## 10. Motion

Motion should clarify state changes:

- node selection: quick border and shadow transition,
- branch creation: short edge/node appearance animation,
- context preview: slide or fade in,
- drag canvas: no decorative animation,
- completion suggestion: subtle entrance.

Timing:

- 120ms for hover and focus.
- 180ms for panel transitions.
- 240ms for node creation.

Avoid continuous decorative motion in the workspace.

## 11. Responsive Behavior

Primary target is desktop.

Breakpoints:

- Narrow desktop or tablet: right panel can collapse to drawer.
- Mobile: show tree overview and node detail as separate views.

The app must remain usable at:

- 1366px desktop width,
- 1024px tablet width,
- 390px mobile width for basic review.

Text must fit within buttons, nodes, and panels without overlap. Prefer truncation with tooltip for node titles and source URLs.

## 12. Accessibility

Minimum requirements:

- keyboard focus visible on all controls,
- node selection available by keyboard,
- color is never the only state indicator,
- icons have accessible names,
- contrast is checked for all swatch backgrounds,
- reduced motion mode disables playful rotation and non-essential transitions.

## 13. Do And Do Not

Do:

- use warm cream as the app background,
- use oat borders instead of neutral gray borders,
- use swatch colors to encode product meaning,
- keep tree structure visually central,
- make context boundaries visible,
- keep controls dense but readable,
- show exact LLM context on demand.

Do not:

- build a landing page as the main app screen,
- use folder navigation as the primary model,
- automatically blend sibling branches into the current context,
- use negative letter spacing,
- use oversized hero typography inside the workspace,
- use large decorative color blocks that reduce workspace density,
- place cards inside cards,
- use decorative gradient orbs or abstract background blobs,
- make hover effects so large that controls jump away from the pointer.

## 14. Agent Usage

When implementing UI, use this order of authority:

1. `AGENTS.md` for product invariants.
2. `docs/context-rules.md` for context behavior.
3. This file for visual and interaction rules.
4. Existing code patterns once implementation exists.

Before adding a new component, identify which product job it serves:

- navigate the tree,
- converse in a node,
- inspect context,
- search/retrieve knowledge,
- manage node lifecycle,
- manage external sources.

If it does not serve one of those jobs, it probably does not belong in the MVP UI.
