import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  rootNodeId: text("root_node_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`CURRENT_TIMESTAMP`),
});

export const nodes = sqliteTable("nodes", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id),
  title: text("title").notNull(),
  summary: text("summary"),
  body: text("body"),
  status: text("status", { enum: ["draft", "confirmed", "archived"] }).notNull(),
  createdByType: text("created_by_type", { enum: ["user", "ai", "mixed"] }).notNull(),
  sourcePrompt: text("source_prompt"),
  sourceAnswer: text("source_answer"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`CURRENT_TIMESTAMP`),
});

export const nodeHierarchy = sqliteTable("node_hierarchy", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id),
  parentNodeId: text("parent_node_id").references(() => nodes.id),
  childNodeId: text("child_node_id").notNull().unique().references(() => nodes.id),
  position: real("position").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`CURRENT_TIMESTAMP`),
});

export const nodeEdges = sqliteTable("node_edges", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id),
  fromNodeId: text("from_node_id").notNull().references(() => nodes.id),
  toNodeId: text("to_node_id").notNull().references(() => nodes.id),
  relationType: text("relation_type", { 
    enum: ["related_to", "supports", "contrasts", "example_of", "depends_on"] 
  }).notNull(),
  weight: real("weight").default(1.0),
  createdByType: text("created_by_type", { enum: ["user", "ai", "mixed"] }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`CURRENT_TIMESTAMP`),
});

export const nodeContextSnapshots = sqliteTable("node_context_snapshots", {
  id: text("id").primaryKey(),
  nodeId: text("node_id").notNull().references(() => nodes.id),
  contextSummary: text("context_summary"),
  ancestorSummary: text("ancestor_summary"),
  generatedAt: integer("generated_at", { mode: "timestamp" }).default(sql`CURRENT_TIMESTAMP`),
});

export const nodeGenerationCandidates = sqliteTable("node_generation_candidates", {
  id: text("id").primaryKey(),
  baseNodeId: text("base_node_id").notNull().references(() => nodes.id),
  userQuery: text("user_query"),
  candidateTitle: text("candidate_title"),
  candidateSummary: text("candidate_summary"),
  candidateRelationType: text("candidate_relation_type"),
  candidateMode: text("candidate_mode", { enum: ["child", "branch", "related"] }),
  accepted: integer("accepted", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`CURRENT_TIMESTAMP`),
});
