use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum NodeStatus {
    Draft,
    Confirmed,
    Archived,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum NodeCreatedByType {
    User,
    Ai,
    Mixed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum NodeMode {
    Child,
    Branch,
    Related,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RelationType {
    RelatedTo,
    Supports,
    Contrasts,
    ExampleOf,
    DependsOn,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceSummary {
    pub id: Uuid,
    pub name: String,
    pub description: String,
    pub root_node_id: Option<Uuid>,
    pub node_count: i64,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeRecord {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub title: String,
    pub summary: String,
    pub body: String,
    pub status: NodeStatus,
    pub created_by_type: NodeCreatedByType,
    pub source_prompt: Option<String>,
    pub source_answer: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathNode {
    pub id: Uuid,
    pub title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelatedNode {
    pub id: Uuid,
    pub title: String,
    pub summary: String,
    pub relation_type: RelationType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextSnapshot {
    pub context_summary: String,
    pub ancestor_summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CandidateRecord {
    pub candidate_id: Uuid,
    pub title: String,
    pub summary: String,
    pub mode: NodeMode,
    pub suggested_relation_type: RelationType,
    pub why_this_branch: String,
    pub accepted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceSnapshot {
    pub workspace: WorkspaceSummary,
    pub current_node: NodeRecord,
    pub ancestors: Vec<NodeRecord>,
    pub children: Vec<NodeRecord>,
    pub related_nodes: Vec<RelatedNode>,
    pub recent_nodes: Vec<PathNode>,
    pub context_snapshot: ContextSnapshot,
    pub recent_candidates: Vec<CandidateRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderMetadata {
    pub id: Uuid,
    pub name: String,
    pub base_url: String,
    pub default_model: String,
    pub enabled: bool,
    pub last_checked_at: Option<DateTime<Utc>>,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderSummary {
    pub id: Uuid,
    pub name: String,
    pub base_url: String,
    pub default_model: String,
    pub enabled: bool,
    pub has_api_key: bool,
    pub last_checked_at: Option<DateTime<Utc>>,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateWorkspaceInput {
    pub name: String,
    pub description: String,
    pub initial_question: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateRootNodeInput {
    pub workspace_id: Uuid,
    pub question: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateCandidatesInput {
    pub query: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExpandNodeInput {
    pub mode: NodeMode,
    pub query: Option<String>,
    pub candidate_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateNodeInput {
    pub title: Option<String>,
    pub summary: Option<String>,
    pub body: Option<String>,
    pub status: Option<NodeStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoveNodeInput {
    pub new_parent_id: Uuid,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateEdgeInput {
    pub target_node_id: Uuid,
    pub relation_type: RelationType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchNodesInput {
    pub workspace_id: Uuid,
    pub q: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveProviderInput {
    pub id: Option<Uuid>,
    pub name: String,
    pub base_url: String,
    pub api_key: String,
    pub default_model: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RootNodeDraft {
    pub title: String,
    pub summary: String,
    pub body: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectNodeDraft {
    pub reasoning: String,
    pub title: String,
    pub summary: String,
    pub body: String,
    pub mode: NodeMode,
    pub suggested_relation_type: RelationType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CandidateDraft {
    pub title: String,
    pub summary: String,
    pub mode: NodeMode,
    pub suggested_relation_type: RelationType,
    pub why_this_branch: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Placement {
    pub mode: NodeMode,
    pub parent_node_id: Uuid,
    pub suggested_relation_type: RelationType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchNodeItem {
    pub id: Uuid,
    pub title: String,
    pub summary: String,
    pub path: Vec<PathNode>,
}
