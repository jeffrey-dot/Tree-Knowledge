# Agent Mandates

## TypeScript Integrity
- **No Bypassing**: Do NOT use annotations or hacks to bypass TypeScript compiler checks.
- **Forbidden Patterns**:
  - `// @ts-ignore`
  - `// @ts-nocheck`
  - `// @ts-expect-error` (unless absolutely necessary and explicitly approved for edge cases, but generally avoided)
  - Type casting to `any` (`as any`).
  - Forced non-null assertions (`!`) where a proper type guard or null check can be used.
- **Requirement**: Always prefer explicit type guards, interface definitions, and proper null-handling logic. If a type error occurs, resolve the underlying architectural or typing issue rather than silencing the compiler.
