use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Workspace {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub root_node_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Node {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub title: String,
    pub summary: Option<String>,
    pub body: Option<String>,
    pub status: String,
    pub created_by_type: String,
    pub source_prompt: Option<String>,
    pub source_answer: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateWorkspaceInput {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateNodeInput {
    pub workspace_id: Uuid,
    pub title: String,
    pub summary: Option<String>,
    pub body: Option<String>,
    pub parent_node_id: Option<Uuid>,
    pub status: String,
    pub created_by_type: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NodeEdge {
    pub id: Uuid,
    pub from_node_id: Uuid,
    pub to_node_id: Uuid,
    pub relation_type: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NodeCandidate {
    pub id: Uuid,
    pub base_node_id: Uuid,
    pub title: String,
    pub summary: String,
    pub relation_type: String,
    pub mode: String,
    pub why_this_branch: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WorkspaceSnapshot {
    pub workspace: Workspace,
    pub current_node: Option<Node>,
    pub ancestors: Vec<Node>,
    pub children: Vec<Node>,
    pub edges: Vec<NodeEdge>,
    pub recent_candidates: Vec<NodeCandidate>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LlmProvider {
    pub id: Uuid,
    pub name: String,
    pub base_url: String,
    pub api_key: String,
    pub default_model: String,
    pub is_enabled: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateProviderInput {
    pub name: String,
    pub base_url: String,
    pub api_key: String,
    pub default_model: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LlmGenerationResult {
    pub title: String,
    pub summary: String,
    pub body: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NodeUpdateInput {
    pub title: String,
    pub summary: Option<String>,
    pub body: Option<String>,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LlmCandidatesResult {
    pub candidates: Vec<NodeCandidateOutput>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NodeCandidateOutput {
    pub title: String,
    pub summary: String,
    pub relation_type: String,
    pub mode: String,
    pub why_this_branch: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FullGraph {
    pub nodes: Vec<Node>,
    pub edges: Vec<NodeEdge>,
}
