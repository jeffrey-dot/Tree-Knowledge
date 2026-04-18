use std::{path::PathBuf, sync::Arc};

use uuid::Uuid;

use crate::{
    db::Database,
    errors::{AppError, AppResult},
    llm::{NodeGenerator, ProviderHealth},
    models::{
        CandidateRecord, ContextSnapshot, CreateEdgeInput, CreateRootNodeInput,
        CreateWorkspaceInput, ExpandNodeInput, GenerateCandidatesInput, MoveNodeInput,
        NodeCreatedByType, NodeMode, NodeRecord, Placement, ProviderSummary, SaveProviderInput,
        SearchNodeItem, SearchNodesInput, WorkspaceSnapshot, WorkspaceSummary,
    },
    providers::{KeyringSecretStore, ProviderStore},
};

#[derive(Clone)]
pub struct AppServices {
    db: Database,
    providers: ProviderStore,
    generator: Arc<dyn NodeGenerator>,
}

impl AppServices {
    pub fn new(base_dir: PathBuf) -> AppResult<Self> {
        std::fs::create_dir_all(&base_dir)
            .map_err(|error| AppError::Internal(error.to_string()))?;

        let db = Database::new(base_dir.join("tree-knowledge.sqlite"))?;
        let providers = ProviderStore::new(
            base_dir.join("providers.json"),
            Arc::new(KeyringSecretStore),
        )?;
        let generator = Arc::new(crate::llm::OpenAiCompatibleGenerator::new(
            providers.clone(),
        ));

        Ok(Self {
            db,
            providers,
            generator,
        })
    }

    #[cfg(test)]
    pub fn for_tests(
        base_dir: PathBuf,
        secret_store: Arc<dyn crate::providers::SecretStore>,
        generator: Arc<dyn NodeGenerator>,
    ) -> AppResult<Self> {
        std::fs::create_dir_all(&base_dir)
            .map_err(|error| AppError::Internal(error.to_string()))?;
        Ok(Self {
            db: Database::new(base_dir.join("test.sqlite"))?,
            providers: ProviderStore::new(base_dir.join("providers.json"), secret_store)?,
            generator,
        })
    }

    pub fn list_workspaces(&self) -> AppResult<Vec<WorkspaceSummary>> {
        self.db.list_workspaces()
    }

    pub async fn create_workspace(
        &self,
        input: CreateWorkspaceInput,
    ) -> AppResult<WorkspaceSummary> {
        let name = input.name.trim();
        let initial_question = input.initial_question.trim();
        if name.is_empty() || initial_question.is_empty() {
            return Err(AppError::Validation(
                "name and initial_question are required".into(),
            ));
        }
        self.db.create_workspace(name, input.description.trim())
    }

    pub async fn create_root_node(&self, input: CreateRootNodeInput) -> AppResult<NodeRecord> {
        let question = input.question.trim();
        if question.is_empty() {
            return Err(AppError::Validation("question is required".into()));
        }

        let workspace = self.db.get_workspace(input.workspace_id)?;
        if workspace.root_node_id.is_some() {
            return Err(AppError::Conflict(
                "workspace already has a root node".into(),
            ));
        }

        let draft = self.generator.generate_root_node(question).await?;
        let node = self.db.insert_node(
            input.workspace_id,
            &draft.title,
            &draft.summary,
            &draft.body,
            NodeCreatedByType::Ai,
            Some(question),
            None,
        )?;
        self.db.set_workspace_root(input.workspace_id, node.id)?;
        self.refresh_context_snapshot(node.id).await?;
        Ok(self.db.get_node(node.id)?)
    }

    pub async fn generate_candidates(
        &self,
        node_id: Uuid,
        input: GenerateCandidatesInput,
    ) -> AppResult<Vec<CandidateRecord>> {
        let query = input.query.trim();
        if query.is_empty() {
            return Err(AppError::Validation("query is required".into()));
        }
        let current = self.db.get_node(node_id)?;
        let ancestors = self.db.list_ancestors(node_id)?;
        let related = self.db.list_related_nodes(node_id)?;
        let drafts = self
            .generator
            .generate_candidates(&current, &ancestors, &related, query)
            .await?;
        self.db.replace_candidates(node_id, query, &drafts)
    }

    pub async fn expand_node(
        &self,
        node_id: Uuid,
        input: ExpandNodeInput,
    ) -> AppResult<(NodeRecord, Placement)> {
        let current = self.db.get_node(node_id)?;
        let ancestors = self.db.list_ancestors(node_id)?;
        let related = self.db.list_related_nodes(node_id)?;

        let draft = if let Some(candidate_id) = input.candidate_id {
            let base_node_id = self.db.get_candidate_base_node(candidate_id)?;
            if base_node_id != node_id {
                return Err(AppError::Validation(
                    "candidate does not belong to current node".into(),
                ));
            }
            let candidate = self.db.get_candidate(candidate_id)?;
            self.db.mark_candidate_accepted(candidate_id)?;
            crate::models::DirectNodeDraft {
                reasoning: candidate.why_this_branch.clone(),
                title: candidate.title,
                summary: candidate.summary,
                body: candidate.why_this_branch,
                mode: candidate.mode,
                suggested_relation_type: candidate.suggested_relation_type,
            }
        } else {
            let query = input
                .query
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .ok_or_else(|| AppError::Validation("query or candidate_id is required".into()))?;
            self.generator
                .generate_direct_node(&current, &ancestors, &related, query)
                .await?
        };

        let mode = if input.candidate_id.is_some() {
            draft.mode.clone()
        } else {
            input.mode
        };

        let parent_node_id = match mode {
            NodeMode::Child => current.id,
            NodeMode::Branch => self.db.get_node_parent(current.id)?.unwrap_or(current.id),
            NodeMode::Related => current.id,
        };

        let node = self.db.insert_node(
            current.workspace_id,
            &draft.title,
            &draft.summary,
            &draft.body,
            NodeCreatedByType::Ai,
            input.query.as_deref(),
            Some(&draft.reasoning),
        )?;
        self.db
            .insert_hierarchy(current.workspace_id, parent_node_id, node.id)?;

        if matches!(mode, NodeMode::Related)
            || draft.suggested_relation_type != crate::models::RelationType::RelatedTo
        {
            self.db.insert_edge(
                current.workspace_id,
                current.id,
                node.id,
                draft.suggested_relation_type.clone(),
            )?;
        }

        self.refresh_context_snapshot(node.id).await?;

        Ok((
            self.db.get_node(node.id)?,
            Placement {
                mode,
                parent_node_id,
                suggested_relation_type: draft.suggested_relation_type,
            },
        ))
    }

    pub async fn update_node(
        &self,
        node_id: Uuid,
        input: crate::models::UpdateNodeInput,
    ) -> AppResult<NodeRecord> {
        let current = self.db.get_node(node_id)?;
        let title = input.title.unwrap_or(current.title);
        let summary = input.summary.unwrap_or(current.summary);
        let body = input.body.unwrap_or(current.body);
        let status = input.status.unwrap_or(current.status);
        self.db
            .update_node(node_id, &title, &summary, &body, status)?;
        self.refresh_context_snapshot(node_id).await?;
        self.db.get_node(node_id)
    }

    pub async fn move_node(
        &self,
        node_id: Uuid,
        input: MoveNodeInput,
    ) -> AppResult<(Uuid, Option<Uuid>, Uuid)> {
        if node_id == input.new_parent_id {
            return Err(AppError::Validation(
                "node cannot be moved under itself".into(),
            ));
        }

        let node = self.db.get_node(node_id)?;
        let workspace = self.db.get_workspace(node.workspace_id)?;
        if workspace.root_node_id == Some(node_id) {
            return Err(AppError::Validation(
                "root node cannot be moved to a new parent".into(),
            ));
        }

        let new_parent_ancestors = self.db.path_for_node(input.new_parent_id)?;
        if new_parent_ancestors.iter().any(|item| item.id == node_id) {
            return Err(AppError::Validation(
                "moving the node here would create a cycle".into(),
            ));
        }

        let old_parent = self.db.move_node(node_id, input.new_parent_id)?;
        self.refresh_context_snapshot(node_id).await?;
        Ok((node_id, old_parent, input.new_parent_id))
    }

    pub fn create_edge(&self, node_id: Uuid, input: CreateEdgeInput) -> AppResult<()> {
        let node = self.db.get_node(node_id)?;
        let target = self.db.get_node(input.target_node_id)?;
        if node.workspace_id != target.workspace_id {
            return Err(AppError::Validation(
                "cannot connect nodes across workspaces".into(),
            ));
        }
        self.db
            .insert_edge(node.workspace_id, node.id, target.id, input.relation_type)
    }

    pub async fn get_workspace_snapshot(&self, node_id: Uuid) -> AppResult<WorkspaceSnapshot> {
        let current = self.db.get_node(node_id)?;
        let workspace = self.db.get_workspace(current.workspace_id)?;
        let ancestors = self.db.list_ancestors(node_id)?;
        let children = self.db.list_children(node_id)?;
        let related_nodes = self.db.list_related_nodes(node_id)?;
        let recent_nodes = self.db.list_recent_nodes(current.workspace_id, node_id)?;
        let recent_candidates = self.db.list_recent_candidates(node_id)?;
        let context_snapshot = match self.db.get_context_snapshot(node_id)? {
            Some(snapshot) => snapshot,
            None => self.refresh_context_snapshot(node_id).await?,
        };

        Ok(WorkspaceSnapshot {
            workspace,
            current_node: current,
            ancestors,
            children,
            related_nodes,
            recent_nodes,
            context_snapshot,
            recent_candidates,
        })
    }

    pub fn search_nodes(&self, input: SearchNodesInput) -> AppResult<Vec<SearchNodeItem>> {
        if input.q.trim().is_empty() {
            return Ok(Vec::new());
        }

        self.db
            .search_nodes(input.workspace_id, input.q.trim())?
            .into_iter()
            .map(|node| {
                let path = self.db.path_for_node(node.id)?;
                Ok(SearchNodeItem {
                    id: node.id,
                    title: node.title,
                    summary: node.summary,
                    path,
                })
            })
            .collect::<AppResult<Vec<_>>>()
    }

    pub async fn list_providers(&self) -> AppResult<Vec<ProviderSummary>> {
        self.providers.list().await
    }

    pub async fn save_provider(&self, input: SaveProviderInput) -> AppResult<ProviderSummary> {
        validate_provider_input(&input)?;
        self.providers.save(input).await
    }

    pub async fn test_provider_connection(&self, provider_id: Uuid) -> AppResult<ProviderHealth> {
        let health = self.generator.test_provider_connection(provider_id).await?;
        let message = if health.ok {
            None
        } else {
            Some(health.message.clone())
        };
        self.providers.update_health(provider_id, message)?;
        Ok(health)
    }

    async fn refresh_context_snapshot(&self, node_id: Uuid) -> AppResult<ContextSnapshot> {
        let current = self.db.get_node(node_id)?;
        let ancestors = self.db.list_ancestors(node_id)?;
        let snapshot = self
            .generator
            .generate_context_snapshot(&current, &ancestors)
            .await?;
        self.db.upsert_context_snapshot(node_id, &snapshot)?;
        Ok(snapshot)
    }
}

fn validate_provider_input(input: &SaveProviderInput) -> AppResult<()> {
    if input.name.trim().is_empty()
        || input.base_url.trim().is_empty()
        || input.default_model.trim().is_empty()
    {
        return Err(AppError::Validation(
            "name, base_url and default_model are required".into(),
        ));
    }
    if input.id.is_none() && input.api_key.trim().is_empty() {
        return Err(AppError::Validation(
            "api_key is required when creating a provider".into(),
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use async_trait::async_trait;
    use tempfile::tempdir;
    use uuid::Uuid;

    use crate::{
        errors::AppResult,
        llm::{NodeGenerator, ProviderHealth},
        models::{
            CandidateDraft, ContextSnapshot, CreateEdgeInput, CreateRootNodeInput,
            CreateWorkspaceInput, DirectNodeDraft, MoveNodeInput, NodeMode, NodeRecord,
            RelatedNode, RelationType, RootNodeDraft, SaveProviderInput, SearchNodesInput,
        },
        providers::FileSecretStore,
    };

    use super::AppServices;

    #[derive(Clone)]
    struct StubGenerator;

    #[async_trait]
    impl NodeGenerator for StubGenerator {
        async fn generate_root_node(&self, question: &str) -> AppResult<RootNodeDraft> {
            Ok(RootNodeDraft {
                title: "Root".into(),
                summary: question.into(),
                body: format!("Body: {question}"),
            })
        }

        async fn generate_candidates(
            &self,
            _current: &NodeRecord,
            _ancestors: &[NodeRecord],
            _related: &[RelatedNode],
            _query: &str,
        ) -> AppResult<Vec<CandidateDraft>> {
            Ok(vec![CandidateDraft {
                title: "Branch".into(),
                summary: "Candidate".into(),
                mode: NodeMode::Child,
                suggested_relation_type: RelationType::RelatedTo,
                why_this_branch: "Because".into(),
            }])
        }

        async fn generate_direct_node(
            &self,
            _current: &NodeRecord,
            _ancestors: &[NodeRecord],
            _related: &[RelatedNode],
            _query: &str,
        ) -> AppResult<DirectNodeDraft> {
            Ok(DirectNodeDraft {
                reasoning: "Reason".into(),
                title: "Direct".into(),
                summary: "Summary".into(),
                body: "Body".into(),
                mode: NodeMode::Child,
                suggested_relation_type: RelationType::RelatedTo,
            })
        }

        async fn generate_context_snapshot(
            &self,
            current: &NodeRecord,
            ancestors: &[NodeRecord],
        ) -> AppResult<ContextSnapshot> {
            Ok(ContextSnapshot {
                context_summary: current.summary.clone(),
                ancestor_summary: ancestors
                    .iter()
                    .map(|item| item.title.clone())
                    .collect::<Vec<_>>()
                    .join(" / "),
            })
        }

        async fn test_provider_connection(&self, _provider_id: Uuid) -> AppResult<ProviderHealth> {
            Ok(ProviderHealth {
                ok: true,
                checked_at: chrono::Utc::now(),
                message: "ok".into(),
            })
        }
    }

    #[tokio::test]
    async fn creates_workspace_and_root_node() {
        let temp = tempdir().unwrap();
        let services = AppServices::for_tests(
            temp.path().to_path_buf(),
            Arc::new(FileSecretStore::new(temp.path().join("secrets.json"))),
            Arc::new(StubGenerator),
        )
        .unwrap();

        services
            .save_provider(SaveProviderInput {
                id: None,
                name: "Local".into(),
                base_url: "https://example.com/v1".into(),
                api_key: "secret".into(),
                default_model: "model".into(),
                enabled: true,
            })
            .await
            .unwrap();

        let workspace = services
            .create_workspace(CreateWorkspaceInput {
                name: "Workspace".into(),
                description: "Desc".into(),
                initial_question: "Question".into(),
            })
            .await
            .unwrap();

        let node = services
            .create_root_node(CreateRootNodeInput {
                workspace_id: workspace.id,
                question: "What is Tree Knowledge?".into(),
            })
            .await
            .unwrap();

        let snapshot = services.get_workspace_snapshot(node.id).await.unwrap();
        assert_eq!(snapshot.workspace.root_node_id, Some(node.id));
        assert_eq!(snapshot.current_node.title, "Root");
    }

    #[tokio::test]
    async fn generates_candidates_without_polluting_nodes() {
        let temp = tempdir().unwrap();
        let services = AppServices::for_tests(
            temp.path().to_path_buf(),
            Arc::new(FileSecretStore::new(temp.path().join("secrets.json"))),
            Arc::new(StubGenerator),
        )
        .unwrap();

        services
            .save_provider(SaveProviderInput {
                id: None,
                name: "Local".into(),
                base_url: "https://example.com/v1".into(),
                api_key: "secret".into(),
                default_model: "model".into(),
                enabled: true,
            })
            .await
            .unwrap();

        let workspace = services
            .create_workspace(CreateWorkspaceInput {
                name: "Workspace".into(),
                description: "Desc".into(),
                initial_question: "Question".into(),
            })
            .await
            .unwrap();

        let node = services
            .create_root_node(CreateRootNodeInput {
                workspace_id: workspace.id,
                question: "What is Tree Knowledge?".into(),
            })
            .await
            .unwrap();

        let candidates = services
            .generate_candidates(
                node.id,
                crate::models::GenerateCandidatesInput {
                    query: "More".into(),
                },
            )
            .await
            .unwrap();

        assert_eq!(candidates.len(), 1);
        let snapshot = services.get_workspace_snapshot(node.id).await.unwrap();
        assert_eq!(snapshot.children.len(), 0);
        assert_eq!(snapshot.recent_candidates.len(), 1);
    }

    #[tokio::test]
    async fn keeps_existing_provider_secret_when_editing_without_new_key() {
        let temp = tempdir().unwrap();
        let services = AppServices::for_tests(
            temp.path().to_path_buf(),
            Arc::new(FileSecretStore::new(temp.path().join("secrets.json"))),
            Arc::new(StubGenerator),
        )
        .unwrap();

        let provider = services
            .save_provider(SaveProviderInput {
                id: None,
                name: "Local".into(),
                base_url: "https://example.com/v1".into(),
                api_key: "secret-one".into(),
                default_model: "model-a".into(),
                enabled: true,
            })
            .await
            .unwrap();

        let updated = services
            .save_provider(SaveProviderInput {
                id: Some(provider.id),
                name: "Local".into(),
                base_url: "https://example.com/v1".into(),
                api_key: "".into(),
                default_model: "model-b".into(),
                enabled: true,
            })
            .await
            .unwrap();

        assert!(updated.has_api_key);
    }

    #[tokio::test]
    async fn creates_edges_searches_nodes_and_moves_non_root_nodes() {
        let temp = tempdir().unwrap();
        let services = AppServices::for_tests(
            temp.path().to_path_buf(),
            Arc::new(FileSecretStore::new(temp.path().join("secrets.json"))),
            Arc::new(StubGenerator),
        )
        .unwrap();

        services
            .save_provider(SaveProviderInput {
                id: None,
                name: "Local".into(),
                base_url: "https://example.com/v1".into(),
                api_key: "secret".into(),
                default_model: "model".into(),
                enabled: true,
            })
            .await
            .unwrap();

        let workspace = services
            .create_workspace(CreateWorkspaceInput {
                name: "Workspace".into(),
                description: "Desc".into(),
                initial_question: "Question".into(),
            })
            .await
            .unwrap();

        let root = services
            .create_root_node(CreateRootNodeInput {
                workspace_id: workspace.id,
                question: "What is Tree Knowledge?".into(),
            })
            .await
            .unwrap();

        let (child, _) = services
            .expand_node(
                root.id,
                crate::models::ExpandNodeInput {
                    mode: NodeMode::Child,
                    query: Some("Explain child branch".into()),
                    candidate_id: None,
                },
            )
            .await
            .unwrap();

        services
            .create_edge(
                root.id,
                CreateEdgeInput {
                    target_node_id: child.id,
                    relation_type: RelationType::Supports,
                },
            )
            .unwrap();

        let search = services
            .search_nodes(SearchNodesInput {
                workspace_id: workspace.id,
                q: "Direct".into(),
            })
            .unwrap();
        assert_eq!(search.len(), 1);
        assert_eq!(search[0].path.len(), 2);

        let moved = services
            .move_node(
                child.id,
                MoveNodeInput {
                    new_parent_id: root.id,
                },
            )
            .await
            .unwrap();
        assert_eq!(moved.0, child.id);
    }

    #[tokio::test]
    async fn rejects_root_node_move() {
        let temp = tempdir().unwrap();
        let services = AppServices::for_tests(
            temp.path().to_path_buf(),
            Arc::new(FileSecretStore::new(temp.path().join("secrets.json"))),
            Arc::new(StubGenerator),
        )
        .unwrap();

        services
            .save_provider(SaveProviderInput {
                id: None,
                name: "Local".into(),
                base_url: "https://example.com/v1".into(),
                api_key: "secret".into(),
                default_model: "model".into(),
                enabled: true,
            })
            .await
            .unwrap();

        let workspace = services
            .create_workspace(CreateWorkspaceInput {
                name: "Workspace".into(),
                description: "Desc".into(),
                initial_question: "Question".into(),
            })
            .await
            .unwrap();

        let root = services
            .create_root_node(CreateRootNodeInput {
                workspace_id: workspace.id,
                question: "What is Tree Knowledge?".into(),
            })
            .await
            .unwrap();

        let result = services
            .move_node(
                root.id,
                MoveNodeInput {
                    new_parent_id: Uuid::new_v4(),
                },
            )
            .await;

        assert!(result.is_err());
    }
}
