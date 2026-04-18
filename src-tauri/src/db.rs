use std::{fs, path::PathBuf};

use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

use crate::{
    errors::{AppError, AppResult},
    models::{
        CandidateRecord, ContextSnapshot, NodeCreatedByType, NodeMode, NodeRecord, NodeStatus,
        PathNode, RelatedNode, RelationType, WorkspaceSummary,
    },
};

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  root_node_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  created_by_type TEXT NOT NULL,
  source_prompt TEXT,
  source_answer TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_nodes_workspace_updated_at
  ON nodes(workspace_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS node_hierarchy (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  parent_node_id TEXT NOT NULL,
  child_node_id TEXT NOT NULL UNIQUE,
  position REAL NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_node_hierarchy_parent_position
  ON node_hierarchy(parent_node_id, position);

CREATE TABLE IF NOT EXISTS node_edges (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  from_node_id TEXT NOT NULL,
  to_node_id TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  weight REAL,
  created_by_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(from_node_id, to_node_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_node_edges_from_relation
  ON node_edges(from_node_id, relation_type);

CREATE INDEX IF NOT EXISTS idx_node_edges_to_relation
  ON node_edges(to_node_id, relation_type);

CREATE TABLE IF NOT EXISTS node_context_snapshots (
  id TEXT PRIMARY KEY NOT NULL,
  node_id TEXT NOT NULL UNIQUE,
  context_summary TEXT NOT NULL,
  ancestor_summary TEXT NOT NULL,
  generated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS node_generation_candidates (
  id TEXT PRIMARY KEY NOT NULL,
  base_node_id TEXT NOT NULL,
  user_query TEXT NOT NULL,
  candidate_title TEXT NOT NULL,
  candidate_summary TEXT NOT NULL,
  candidate_relation_type TEXT NOT NULL,
  candidate_mode TEXT NOT NULL,
  why_this_branch TEXT NOT NULL,
  accepted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_node_generation_candidates_base_created
  ON node_generation_candidates(base_node_id, created_at DESC);
"#;

#[derive(Clone)]
pub struct Database {
    path: PathBuf,
}

impl Database {
    pub fn new(path: PathBuf) -> AppResult<Self> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|error| AppError::Internal(error.to_string()))?;
        }

        let database = Self { path };
        database.initialize()?;
        Ok(database)
    }

    pub fn open(&self) -> AppResult<Connection> {
        Ok(Connection::open(&self.path)?)
    }

    fn initialize(&self) -> AppResult<()> {
        let connection = self.open()?;
        connection.execute_batch(SCHEMA)?;
        Ok(())
    }

    pub fn list_workspaces(&self) -> AppResult<Vec<WorkspaceSummary>> {
        let connection = self.open()?;
        let mut statement = connection.prepare(
            r#"
            SELECT
              w.id,
              w.name,
              w.description,
              w.root_node_id,
              w.updated_at,
              COUNT(n.id) AS node_count
            FROM workspaces w
            LEFT JOIN nodes n ON n.workspace_id = w.id
            GROUP BY w.id
            ORDER BY w.updated_at DESC
            "#,
        )?;

        let rows = statement.query_map([], |row| map_workspace_summary(row))?;
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    pub fn get_workspace(&self, workspace_id: Uuid) -> AppResult<WorkspaceSummary> {
        let connection = self.open()?;
        connection
            .query_row(
                r#"
                SELECT
                  w.id,
                  w.name,
                  w.description,
                  w.root_node_id,
                  w.updated_at,
                  COUNT(n.id) AS node_count
                FROM workspaces w
                LEFT JOIN nodes n ON n.workspace_id = w.id
                WHERE w.id = ?1
                GROUP BY w.id
                "#,
                [workspace_id.to_string()],
                map_workspace_summary,
            )
            .optional()?
            .ok_or_else(|| AppError::NotFound("workspace not found".into()))
    }

    pub fn create_workspace(&self, name: &str, description: &str) -> AppResult<WorkspaceSummary> {
        let connection = self.open()?;
        let workspace_id = Uuid::new_v4();
        let now = Utc::now().to_rfc3339();
        connection.execute(
            r#"
            INSERT INTO workspaces (id, name, description, root_node_id, created_at, updated_at)
            VALUES (?1, ?2, ?3, NULL, ?4, ?4)
            "#,
            params![workspace_id.to_string(), name, description, now],
        )?;

        self.get_workspace(workspace_id)
    }

    pub fn set_workspace_root(&self, workspace_id: Uuid, node_id: Uuid) -> AppResult<()> {
        let connection = self.open()?;
        connection.execute(
            "UPDATE workspaces SET root_node_id = ?2, updated_at = ?3 WHERE id = ?1",
            params![
                workspace_id.to_string(),
                node_id.to_string(),
                Utc::now().to_rfc3339()
            ],
        )?;
        Ok(())
    }

    pub fn touch_workspace(&self, workspace_id: Uuid) -> AppResult<()> {
        let connection = self.open()?;
        connection.execute(
            "UPDATE workspaces SET updated_at = ?2 WHERE id = ?1",
            params![workspace_id.to_string(), Utc::now().to_rfc3339()],
        )?;
        Ok(())
    }

    pub fn insert_node(
        &self,
        workspace_id: Uuid,
        title: &str,
        summary: &str,
        body: &str,
        created_by_type: NodeCreatedByType,
        source_prompt: Option<&str>,
        source_answer: Option<&str>,
    ) -> AppResult<NodeRecord> {
        let connection = self.open()?;
        let node_id = Uuid::new_v4();
        let now = Utc::now().to_rfc3339();
        connection.execute(
            r#"
            INSERT INTO nodes (
              id, workspace_id, title, summary, body, status, created_by_type,
              source_prompt, source_answer, created_at, updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)
            "#,
            params![
                node_id.to_string(),
                workspace_id.to_string(),
                title,
                summary,
                body,
                "confirmed",
                created_by_type.to_string(),
                source_prompt,
                source_answer,
                now,
            ],
        )?;
        self.touch_workspace(workspace_id)?;
        self.get_node(node_id)
    }

    pub fn get_node(&self, node_id: Uuid) -> AppResult<NodeRecord> {
        let connection = self.open()?;
        connection
            .query_row(
                r#"
                SELECT
                  id, workspace_id, title, summary, body, status, created_by_type,
                  source_prompt, source_answer, created_at, updated_at
                FROM nodes
                WHERE id = ?1
                "#,
                [node_id.to_string()],
                map_node,
            )
            .optional()?
            .ok_or_else(|| AppError::NotFound("node not found".into()))
    }

    pub fn get_node_parent(&self, node_id: Uuid) -> AppResult<Option<Uuid>> {
        let connection = self.open()?;
        connection
            .query_row(
                "SELECT parent_node_id FROM node_hierarchy WHERE child_node_id = ?1",
                [node_id.to_string()],
                |row| parse_uuid(row.get::<_, String>(0)?),
            )
            .optional()
            .map_err(Into::into)
    }

    pub fn insert_hierarchy(
        &self,
        workspace_id: Uuid,
        parent_node_id: Uuid,
        child_node_id: Uuid,
    ) -> AppResult<()> {
        if parent_node_id == child_node_id {
            return Err(AppError::Validation(
                "parent and child cannot be the same node".into(),
            ));
        }

        let connection = self.open()?;
        let next_position = connection
            .query_row(
                "SELECT COALESCE(MAX(position), 0) + 1 FROM node_hierarchy WHERE parent_node_id = ?1",
                [parent_node_id.to_string()],
                |row| row.get::<_, f64>(0),
            )
            .unwrap_or(1.0);

        connection.execute(
            r#"
            INSERT INTO node_hierarchy (id, workspace_id, parent_node_id, child_node_id, position, created_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            "#,
            params![
                Uuid::new_v4().to_string(),
                workspace_id.to_string(),
                parent_node_id.to_string(),
                child_node_id.to_string(),
                next_position,
                Utc::now().to_rfc3339(),
            ],
        )?;
        Ok(())
    }

    pub fn update_node(
        &self,
        node_id: Uuid,
        title: &str,
        summary: &str,
        body: &str,
        status: NodeStatus,
    ) -> AppResult<NodeRecord> {
        let connection = self.open()?;
        connection.execute(
            "UPDATE nodes SET title = ?2, summary = ?3, body = ?4, status = ?5, updated_at = ?6 WHERE id = ?1",
            params![
                node_id.to_string(),
                title,
                summary,
                body,
                status.to_string(),
                Utc::now().to_rfc3339(),
            ],
        )?;
        let node = self.get_node(node_id)?;
        self.touch_workspace(node.workspace_id)?;
        Ok(node)
    }

    pub fn move_node(&self, node_id: Uuid, new_parent_id: Uuid) -> AppResult<Option<Uuid>> {
        let node = self.get_node(node_id)?;
        let connection = self.open()?;
        let old_parent = self.get_node_parent(node_id)?;
        let affected = connection.execute(
            "UPDATE node_hierarchy SET parent_node_id = ?2 WHERE child_node_id = ?1",
            params![node_id.to_string(), new_parent_id.to_string()],
        )?;
        if affected == 0 {
            return Err(AppError::Conflict(
                "node has no hierarchy record and cannot be moved".into(),
            ));
        }
        self.touch_workspace(node.workspace_id)?;
        Ok(old_parent)
    }

    pub fn list_ancestors(&self, node_id: Uuid) -> AppResult<Vec<NodeRecord>> {
        let mut ancestors = Vec::new();
        let mut current_id = node_id;

        while let Some(parent_id) = self.get_node_parent(current_id)? {
            let parent = self.get_node(parent_id)?;
            current_id = parent.id;
            ancestors.push(parent);
        }

        ancestors.reverse();
        Ok(ancestors)
    }

    pub fn list_children(&self, node_id: Uuid) -> AppResult<Vec<NodeRecord>> {
        let connection = self.open()?;
        let mut statement = connection.prepare(
            r#"
            SELECT
              n.id, n.workspace_id, n.title, n.summary, n.body, n.status, n.created_by_type,
              n.source_prompt, n.source_answer, n.created_at, n.updated_at
            FROM node_hierarchy h
            INNER JOIN nodes n ON n.id = h.child_node_id
            WHERE h.parent_node_id = ?1 AND n.status != 'archived'
            ORDER BY h.position ASC
            "#,
        )?;
        let rows = statement.query_map([node_id.to_string()], map_node)?;
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    pub fn insert_edge(
        &self,
        workspace_id: Uuid,
        from_node_id: Uuid,
        to_node_id: Uuid,
        relation_type: RelationType,
    ) -> AppResult<()> {
        if from_node_id == to_node_id {
            return Err(AppError::Validation(
                "self-loop edges are not allowed".into(),
            ));
        }

        let connection = self.open()?;
        connection.execute(
            r#"
            INSERT OR IGNORE INTO node_edges (
              id, workspace_id, from_node_id, to_node_id, relation_type, weight, created_by_type, created_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, NULL, 'ai', ?6)
            "#,
            params![
                Uuid::new_v4().to_string(),
                workspace_id.to_string(),
                from_node_id.to_string(),
                to_node_id.to_string(),
                relation_type.to_string(),
                Utc::now().to_rfc3339(),
            ],
        )?;
        Ok(())
    }

    pub fn list_related_nodes(&self, node_id: Uuid) -> AppResult<Vec<RelatedNode>> {
        let connection = self.open()?;
        let mut statement = connection.prepare(
            r#"
            SELECT
              n.id,
              n.title,
              n.summary,
              CASE WHEN e.from_node_id = ?1 THEN e.relation_type ELSE e.relation_type END AS relation_type
            FROM node_edges e
            INNER JOIN nodes n
              ON n.id = CASE WHEN e.from_node_id = ?1 THEN e.to_node_id ELSE e.from_node_id END
            WHERE (e.from_node_id = ?1 OR e.to_node_id = ?1) AND n.status != 'archived'
            ORDER BY n.updated_at DESC
            "#,
        )?;
        let rows = statement.query_map([node_id.to_string()], |row| {
            Ok(RelatedNode {
                id: parse_uuid(row.get::<_, String>(0)?)?,
                title: row.get(1)?,
                summary: row.get(2)?,
                relation_type: RelationType::from_db(&row.get::<_, String>(3)?)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    pub fn upsert_context_snapshot(
        &self,
        node_id: Uuid,
        snapshot: &ContextSnapshot,
    ) -> AppResult<()> {
        let connection = self.open()?;
        connection.execute(
            r#"
            INSERT INTO node_context_snapshots (id, node_id, context_summary, ancestor_summary, generated_at)
            VALUES (?1, ?2, ?3, ?4, ?5)
            ON CONFLICT(node_id) DO UPDATE SET
              context_summary = excluded.context_summary,
              ancestor_summary = excluded.ancestor_summary,
              generated_at = excluded.generated_at
            "#,
            params![
                Uuid::new_v4().to_string(),
                node_id.to_string(),
                snapshot.context_summary,
                snapshot.ancestor_summary,
                Utc::now().to_rfc3339(),
            ],
        )?;
        Ok(())
    }

    pub fn get_context_snapshot(&self, node_id: Uuid) -> AppResult<Option<ContextSnapshot>> {
        let connection = self.open()?;
        connection
            .query_row(
                "SELECT context_summary, ancestor_summary FROM node_context_snapshots WHERE node_id = ?1",
                [node_id.to_string()],
                |row| {
                    Ok(ContextSnapshot {
                        context_summary: row.get(0)?,
                        ancestor_summary: row.get(1)?,
                    })
                },
            )
            .optional()
            .map_err(Into::into)
    }

    pub fn replace_candidates(
        &self,
        base_node_id: Uuid,
        user_query: &str,
        candidates: &[crate::models::CandidateDraft],
    ) -> AppResult<Vec<CandidateRecord>> {
        let connection = self.open()?;
        connection.execute(
            "DELETE FROM node_generation_candidates WHERE base_node_id = ?1",
            [base_node_id.to_string()],
        )?;

        let mut result = Vec::with_capacity(candidates.len());
        for candidate in candidates {
            let candidate_id = Uuid::new_v4();
            connection.execute(
                r#"
                INSERT INTO node_generation_candidates (
                  id, base_node_id, user_query, candidate_title, candidate_summary,
                  candidate_relation_type, candidate_mode, why_this_branch, accepted, created_at
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0, ?9)
                "#,
                params![
                    candidate_id.to_string(),
                    base_node_id.to_string(),
                    user_query,
                    candidate.title,
                    candidate.summary,
                    candidate.suggested_relation_type.to_string(),
                    candidate.mode.to_string(),
                    candidate.why_this_branch,
                    Utc::now().to_rfc3339(),
                ],
            )?;
            result.push(CandidateRecord {
                candidate_id,
                title: candidate.title.clone(),
                summary: candidate.summary.clone(),
                mode: candidate.mode.clone(),
                suggested_relation_type: candidate.suggested_relation_type.clone(),
                why_this_branch: candidate.why_this_branch.clone(),
                accepted: false,
            });
        }

        Ok(result)
    }

    pub fn get_candidate(&self, candidate_id: Uuid) -> AppResult<CandidateRecord> {
        let connection = self.open()?;
        connection
            .query_row(
                r#"
                SELECT id, candidate_title, candidate_summary, candidate_mode, candidate_relation_type, why_this_branch, accepted
                FROM node_generation_candidates
                WHERE id = ?1
                "#,
                [candidate_id.to_string()],
                |row| {
                    Ok(CandidateRecord {
                        candidate_id: parse_uuid(row.get::<_, String>(0)?)?,
                        title: row.get(1)?,
                        summary: row.get(2)?,
                        mode: NodeMode::from_db(&row.get::<_, String>(3)?)?,
                        suggested_relation_type: RelationType::from_db(&row.get::<_, String>(4)?)?,
                        why_this_branch: row.get(5)?,
                        accepted: row.get::<_, i64>(6)? == 1,
                    })
                },
            )
            .optional()?
            .ok_or_else(|| AppError::NotFound("candidate not found".into()))
    }

    pub fn get_candidate_base_node(&self, candidate_id: Uuid) -> AppResult<Uuid> {
        let connection = self.open()?;
        connection
            .query_row(
                "SELECT base_node_id FROM node_generation_candidates WHERE id = ?1",
                [candidate_id.to_string()],
                |row| parse_uuid(row.get::<_, String>(0)?),
            )
            .optional()?
            .ok_or_else(|| AppError::NotFound("candidate not found".into()))
    }

    pub fn mark_candidate_accepted(&self, candidate_id: Uuid) -> AppResult<()> {
        let connection = self.open()?;
        connection.execute(
            "UPDATE node_generation_candidates SET accepted = 1 WHERE id = ?1",
            [candidate_id.to_string()],
        )?;
        Ok(())
    }

    pub fn list_recent_candidates(&self, base_node_id: Uuid) -> AppResult<Vec<CandidateRecord>> {
        let connection = self.open()?;
        let mut statement = connection.prepare(
            r#"
            SELECT id, candidate_title, candidate_summary, candidate_mode, candidate_relation_type, why_this_branch, accepted
            FROM node_generation_candidates
            WHERE base_node_id = ?1
            ORDER BY created_at DESC
            LIMIT 5
            "#,
        )?;
        let rows = statement.query_map([base_node_id.to_string()], |row| {
            Ok(CandidateRecord {
                candidate_id: parse_uuid(row.get::<_, String>(0)?)?,
                title: row.get(1)?,
                summary: row.get(2)?,
                mode: NodeMode::from_db(&row.get::<_, String>(3)?)?,
                suggested_relation_type: RelationType::from_db(&row.get::<_, String>(4)?)?,
                why_this_branch: row.get(5)?,
                accepted: row.get::<_, i64>(6)? == 1,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    pub fn list_recent_nodes(
        &self,
        workspace_id: Uuid,
        exclude_node_id: Uuid,
    ) -> AppResult<Vec<PathNode>> {
        let connection = self.open()?;
        let mut statement = connection.prepare(
            r#"
            SELECT id, title
            FROM nodes
            WHERE workspace_id = ?1 AND id != ?2 AND status != 'archived'
            ORDER BY updated_at DESC
            LIMIT 5
            "#,
        )?;
        let rows = statement.query_map(
            params![workspace_id.to_string(), exclude_node_id.to_string()],
            |row| {
                Ok(PathNode {
                    id: parse_uuid(row.get::<_, String>(0)?)?,
                    title: row.get(1)?,
                })
            },
        )?;
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    pub fn search_nodes(&self, workspace_id: Uuid, q: &str) -> AppResult<Vec<NodeRecord>> {
        let connection = self.open()?;
        let pattern = format!("%{}%", q.trim());
        let mut statement = connection.prepare(
            r#"
            SELECT
              id, workspace_id, title, summary, body, status, created_by_type,
              source_prompt, source_answer, created_at, updated_at
            FROM nodes
            WHERE workspace_id = ?1
              AND status != 'archived'
              AND (title LIKE ?2 OR summary LIKE ?2)
            ORDER BY updated_at DESC
            LIMIT 20
            "#,
        )?;
        let rows = statement.query_map(params![workspace_id.to_string(), pattern], map_node)?;
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    pub fn path_for_node(&self, node_id: Uuid) -> AppResult<Vec<PathNode>> {
        let ancestors = self.list_ancestors(node_id)?;
        let current = self.get_node(node_id)?;
        let mut path = ancestors
            .into_iter()
            .map(|item| PathNode {
                id: item.id,
                title: item.title,
            })
            .collect::<Vec<_>>();
        path.push(PathNode {
            id: current.id,
            title: current.title,
        });
        Ok(path)
    }
}

fn map_workspace_summary(row: &Row<'_>) -> rusqlite::Result<WorkspaceSummary> {
    Ok(WorkspaceSummary {
        id: parse_uuid(row.get::<_, String>(0)?)?,
        name: row.get(1)?,
        description: row.get(2)?,
        root_node_id: row
            .get::<_, Option<String>>(3)?
            .map(parse_uuid)
            .transpose()?,
        updated_at: parse_datetime(row.get::<_, String>(4)?)?,
        node_count: row.get(5)?,
    })
}

fn map_node(row: &Row<'_>) -> rusqlite::Result<NodeRecord> {
    Ok(NodeRecord {
        id: parse_uuid(row.get::<_, String>(0)?)?,
        workspace_id: parse_uuid(row.get::<_, String>(1)?)?,
        title: row.get(2)?,
        summary: row.get(3)?,
        body: row.get(4)?,
        status: NodeStatus::from_db(&row.get::<_, String>(5)?)?,
        created_by_type: NodeCreatedByType::from_db(&row.get::<_, String>(6)?)?,
        source_prompt: row.get(7)?,
        source_answer: row.get(8)?,
        created_at: parse_datetime(row.get::<_, String>(9)?)?,
        updated_at: parse_datetime(row.get::<_, String>(10)?)?,
    })
}

fn parse_uuid(value: String) -> rusqlite::Result<Uuid> {
    Uuid::parse_str(&value).map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(
            value.len(),
            rusqlite::types::Type::Text,
            Box::new(error),
        )
    })
}

fn parse_datetime(value: String) -> rusqlite::Result<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(&value)
        .map(|date| date.with_timezone(&Utc))
        .map_err(|error| {
            rusqlite::Error::FromSqlConversionFailure(
                value.len(),
                rusqlite::types::Type::Text,
                Box::new(error),
            )
        })
}

macro_rules! impl_string_enum {
    ($name:ident { $($variant:ident => $value:literal),* $(,)? }) => {
        impl $name {
            pub fn from_db(value: &str) -> rusqlite::Result<Self> {
                match value {
                    $($value => Ok(Self::$variant),)*
                    _ => Err(rusqlite::Error::InvalidParameterName(value.to_string())),
                }
            }
        }

        impl ToString for $name {
            fn to_string(&self) -> String {
                match self {
                    $(Self::$variant => $value.to_string(),)*
                }
            }
        }
    };
}

impl_string_enum!(NodeStatus {
    Draft => "draft",
    Confirmed => "confirmed",
    Archived => "archived",
});

impl_string_enum!(NodeCreatedByType {
    User => "user",
    Ai => "ai",
    Mixed => "mixed",
});

impl_string_enum!(NodeMode {
    Child => "child",
    Branch => "branch",
    Related => "related",
});

impl_string_enum!(RelationType {
    RelatedTo => "related_to",
    Supports => "supports",
    Contrasts => "contrasts",
    ExampleOf => "example_of",
    DependsOn => "depends_on",
});
