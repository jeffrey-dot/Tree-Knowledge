import { z } from "zod";

export const nodeStatusSchema = z.enum(["draft", "confirmed", "archived"]);
export const nodeModeSchema = z.enum(["child", "branch", "related"]);
export const relationTypeSchema = z.enum([
  "related_to",
  "supports",
  "contrasts",
  "example_of",
  "depends_on",
]);

export type NodeStatus = z.infer<typeof nodeStatusSchema>;
export type NodeMode = z.infer<typeof nodeModeSchema>;
export type RelationType = z.infer<typeof relationTypeSchema>;

export const workspaceSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  root_node_id: z.string().uuid().nullable(),
  node_count: z.number().int().nonnegative(),
  updated_at: z.string(),
});

export const providerSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  base_url: z.string().url(),
  default_model: z.string().min(1),
  enabled: z.boolean(),
  has_api_key: z.boolean(),
  last_checked_at: z.string().nullable(),
  last_error: z.string().nullable(),
});

export const nodeSummarySchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  title: z.string(),
  summary: z.string(),
  body: z.string(),
  status: nodeStatusSchema,
  created_by_type: z.enum(["user", "ai", "mixed"]),
  source_prompt: z.string().nullable(),
  source_answer: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const pathNodeSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
});

export const searchNodeItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  summary: z.string(),
  path: z.array(pathNodeSchema),
});

export const relatedNodeSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  summary: z.string(),
  relation_type: relationTypeSchema,
});

export const contextSnapshotSchema = z.object({
  context_summary: z.string(),
  ancestor_summary: z.string(),
});

export const candidateSchema = z.object({
  candidate_id: z.string().uuid(),
  title: z.string(),
  summary: z.string(),
  mode: nodeModeSchema,
  suggested_relation_type: relationTypeSchema,
  why_this_branch: z.string(),
  accepted: z.boolean().default(false),
});

export const workspaceSnapshotSchema = z.object({
  workspace: workspaceSummarySchema,
  current_node: nodeSummarySchema,
  ancestors: z.array(nodeSummarySchema),
  children: z.array(nodeSummarySchema),
  related_nodes: z.array(relatedNodeSchema),
  recent_nodes: z.array(pathNodeSchema),
  context_snapshot: contextSnapshotSchema,
  recent_candidates: z.array(candidateSchema),
});

export const createWorkspaceInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  initial_question: z.string().min(1),
});

export const createRootNodeInputSchema = z.object({
  workspace_id: z.string().uuid(),
  question: z.string().min(1),
});

export const saveProviderInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  base_url: z.string().url(),
  api_key: z.string(),
  default_model: z.string().min(1),
  enabled: z.boolean(),
}).refine((value) => value.id !== undefined || value.api_key.trim().length > 0, {
  message: "api_key is required when creating a provider",
});

export const generateCandidatesInputSchema = z.object({
  query: z.string().min(1),
});

export const expandNodeInputSchema = z
  .object({
    mode: nodeModeSchema,
    query: z.string().optional(),
    candidate_id: z.string().uuid().optional(),
  })
  .refine((value) => Boolean(value.query || value.candidate_id), {
    message: "query or candidate_id is required",
  });

export const updateNodeInputSchema = z.object({
  title: z.string().min(1).optional(),
  summary: z.string().optional(),
  body: z.string().optional(),
  status: nodeStatusSchema.optional(),
});

export const moveNodeInputSchema = z.object({
  new_parent_id: z.string().uuid(),
});

export const createEdgeInputSchema = z.object({
  target_node_id: z.string().uuid(),
  relation_type: relationTypeSchema,
});

export const searchNodesInputSchema = z.object({
  workspace_id: z.string().uuid(),
  q: z.string(),
});

export type WorkspaceSummary = z.infer<typeof workspaceSummarySchema>;
export type Provider = z.infer<typeof providerSchema>;
export type NodeSummary = z.infer<typeof nodeSummarySchema>;
export type PathNode = z.infer<typeof pathNodeSchema>;
export type Candidate = z.infer<typeof candidateSchema>;
export type SearchNodeItem = z.infer<typeof searchNodeItemSchema>;
export type WorkspaceSnapshot = z.infer<typeof workspaceSnapshotSchema>;
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceInputSchema>;
export type CreateRootNodeInput = z.infer<typeof createRootNodeInputSchema>;
export type SaveProviderInput = z.infer<typeof saveProviderInputSchema>;
export type GenerateCandidatesInput = z.infer<typeof generateCandidatesInputSchema>;
export type ExpandNodeInput = z.infer<typeof expandNodeInputSchema>;
export type UpdateNodeInput = z.infer<typeof updateNodeInputSchema>;
export type MoveNodeInput = z.infer<typeof moveNodeInputSchema>;
export type CreateEdgeInput = z.infer<typeof createEdgeInputSchema>;
export type SearchNodesInput = z.infer<typeof searchNodesInputSchema>;
