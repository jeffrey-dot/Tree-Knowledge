use rusqlite::{params_from_iter, Connection, Result};
use std::path::PathBuf;
use std::fs;
use crate::models::{
    Workspace, CreateWorkspaceInput, Node, CreateNodeInput, 
    WorkspaceSnapshot, LlmProvider, CreateProviderInput, NodeEdge,
    NodeUpdateInput, NodeCandidate
};
use uuid::Uuid;
use chrono::Utc;

pub struct DbManager {
    pub conn: Connection,
}

impl DbManager {
    pub fn new(db_path: PathBuf) -> Result<Self> {
        if let Some(parent) = db_path.parent() {
            fs::create_dir_all(parent).expect("Failed to create database directory");
        }
        let conn = Connection::open(db_path)?;
        let manager = DbManager { conn };
        manager.init_schema()?;
        Ok(manager)
    }

    fn init_schema(&self) -> Result<()> {
        self.conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS workspaces (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                root_node_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS nodes (
                id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                title TEXT NOT NULL,
                summary TEXT,
                body TEXT,
                status TEXT NOT NULL,
                created_by_type TEXT NOT NULL,
                source_prompt TEXT,
                source_answer TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
            );
            CREATE TABLE IF NOT EXISTS node_hierarchy (
                id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                parent_node_id TEXT,
                child_node_id TEXT NOT NULL UNIQUE,
                position REAL NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
                FOREIGN KEY(parent_node_id) REFERENCES nodes(id),
                FOREIGN KEY(child_node_id) REFERENCES nodes(id)
            );
            CREATE TABLE IF NOT EXISTS node_edges (
                id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                from_node_id TEXT NOT NULL,
                to_node_id TEXT NOT NULL,
                relation_type TEXT NOT NULL,
                weight REAL DEFAULT 1.0,
                created_by_type TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
                FOREIGN KEY(from_node_id) REFERENCES nodes(id),
                FOREIGN KEY(to_node_id) REFERENCES nodes(id)
            );
            CREATE TABLE IF NOT EXISTS node_context_snapshots (
                id TEXT PRIMARY KEY,
                node_id TEXT NOT NULL,
                context_summary TEXT,
                ancestor_summary TEXT,
                generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(node_id) REFERENCES nodes(id)
            );
            CREATE TABLE IF NOT EXISTS node_generation_candidates (
                id TEXT PRIMARY KEY,
                base_node_id TEXT NOT NULL,
                candidate_title TEXT,
                candidate_summary TEXT,
                candidate_relation_type TEXT,
                candidate_mode TEXT,
                why_this_branch TEXT,
                accepted BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(base_node_id) REFERENCES nodes(id)
            );
            CREATE TABLE IF NOT EXISTS llm_providers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                base_url TEXT NOT NULL,
                api_key TEXT NOT NULL,
                default_model TEXT NOT NULL,
                is_enabled BOOLEAN DEFAULT 1
            );"
        )?;
        Ok(())
    }

    pub fn list_providers(&self) -> Result<Vec<LlmProvider>> {
        let mut stmt = self.conn.prepare("SELECT id, name, base_url, api_key, default_model, is_enabled FROM llm_providers")?;
        let rows = stmt.query_map([], |row| {
            Ok(LlmProvider {
                id: Uuid::parse_str(&row.get::<_, String>(0)?).unwrap_or_else(|_| Uuid::nil()),
                name: row.get(1)?,
                base_url: row.get(2)?,
                api_key: row.get(3)?,
                default_model: row.get(4)?,
                is_enabled: row.get(5)?,
            })
        })?;

        let mut providers = Vec::new();
        for row in rows {
            providers.push(row?);
        }
        Ok(providers)
    }

    pub fn create_provider(&self, input: CreateProviderInput) -> Result<LlmProvider> {
        let id = Uuid::new_v4();
        self.conn.execute(
            "INSERT INTO llm_providers (id, name, base_url, api_key, default_model, is_enabled) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            (&id.to_string(), &input.name, &input.base_url, &input.api_key, &input.default_model, &true),
        )?;
        
        Ok(LlmProvider {
            id,
            name: input.name,
            base_url: input.base_url,
            api_key: input.api_key,
            default_model: input.default_model,
            is_enabled: true,
        })
    }

    pub fn get_active_provider(&self) -> Result<Option<LlmProvider>> {
        let mut stmt = self.conn.prepare("SELECT id, name, base_url, api_key, default_model, is_enabled FROM llm_providers WHERE is_enabled = 1 LIMIT 1")?;
        let mut rows = stmt.query_map([], |row| {
            Ok(LlmProvider {
                id: Uuid::parse_str(&row.get::<_, String>(0)?).unwrap_or_else(|_| Uuid::nil()),
                name: row.get(1)?,
                base_url: row.get(2)?,
                api_key: row.get(3)?,
                default_model: row.get(4)?,
                is_enabled: row.get(5)?,
            })
        })?;

        if let Some(row) = rows.next() {
            Ok(Some(row?))
        } else {
            Ok(None)
        }
    }

    pub fn list_workspaces(&self) -> Result<Vec<Workspace>> {
        let mut stmt = self.conn.prepare("SELECT id, name, description, root_node_id, created_at, updated_at FROM workspaces")?;
        let rows = stmt.query_map([], |row| {
            Ok(Workspace {
                id: Uuid::parse_str(&row.get::<_, String>(0)?).unwrap_or_else(|_| Uuid::nil()),
                name: row.get(1)?,
                description: row.get(2)?,
                root_node_id: row.get::<_, Option<String>>(3)?.and_then(|s| Uuid::parse_str(&s).ok()),
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })?;

        let mut workspaces = Vec::new();
        for row in rows {
            workspaces.push(row?);
        }
        Ok(workspaces)
    }

    pub fn create_workspace(&self, input: CreateWorkspaceInput) -> Result<Workspace> {
        let id = Uuid::new_v4();
        let now = Utc::now();
        self.conn.execute(
            "INSERT INTO workspaces (id, name, description, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            (&id.to_string(), &input.name, &input.description, &now, &now),
        )?;
        
        Ok(Workspace {
            id,
            name: input.name,
            description: input.description,
            root_node_id: None,
            created_at: now,
            updated_at: now,
        })
    }

    pub fn update_workspace_name(&self, id: Uuid, name: String) -> Result<()> {
        let now = Utc::now();
        self.conn.execute(
            "UPDATE workspaces SET name = ?1, updated_at = ?2 WHERE id = ?3",
            (&name, &now, &id.to_string()),
        )?;
        Ok(())
    }

    pub fn delete_workspace(&self, id: Uuid) -> Result<()> {
        let id_str = id.to_string();
        
        // 1. Delete all edges in this workspace
        self.conn.execute("DELETE FROM node_edges WHERE workspace_id = ?1", [&id_str])?;
        
        // 2. Delete all hierarchy records in this workspace
        self.conn.execute("DELETE FROM node_hierarchy WHERE workspace_id = ?1", [&id_str])?;
        
        // 3. Delete all candidates related to nodes in this workspace
        self.conn.execute(
            "DELETE FROM node_generation_candidates WHERE base_node_id IN (SELECT id FROM nodes WHERE workspace_id = ?1)", 
            [&id_str]
        )?;

        // 4. Delete all snapshots related to nodes in this workspace
        self.conn.execute(
            "DELETE FROM node_context_snapshots WHERE node_id IN (SELECT id FROM nodes WHERE workspace_id = ?1)", 
            [&id_str]
        )?;

        // 5. Delete all nodes in this workspace
        self.conn.execute("DELETE FROM nodes WHERE workspace_id = ?1", [&id_str])?;

        // 6. Finally, delete the workspace itself
        self.conn.execute("DELETE FROM workspaces WHERE id = ?1", [&id_str])?;
        
        Ok(())
    }

    pub fn delete_node_branch(&self, node_id: Uuid) -> Result<(Option<Uuid>, bool)> {
        let node = self.get_node(node_id)?;
        let workspace_root_node_id = self.conn.query_row(
            "SELECT root_node_id FROM workspaces WHERE id = ?1",
            [&node.workspace_id.to_string()],
            |row| row.get::<_, Option<String>>(0),
        )?;

        if workspace_root_node_id.as_deref() == Some(node_id.to_string().as_str()) {
            self.delete_workspace(node.workspace_id)?;
            return Ok((None, true));
        }

        let parent_node_id = match self.conn.query_row(
            "SELECT parent_node_id FROM node_hierarchy WHERE child_node_id = ?1",
            [&node_id.to_string()],
            |row| row.get::<_, Option<String>>(0),
        ) {
            Ok(parent_node_id) => parent_node_id.and_then(|value| Uuid::parse_str(&value).ok()),
            Err(rusqlite::Error::QueryReturnedNoRows) => None,
            Err(error) => return Err(error),
        };

        let subtree_node_ids = self.collect_subtree_node_ids(node_id)?;
        let subtree_node_id_strings: Vec<String> = subtree_node_ids.into_iter().map(|id| id.to_string()).collect();

        if subtree_node_id_strings.is_empty() {
            return Ok((parent_node_id, false));
        }

        let placeholders = vec!["?"; subtree_node_id_strings.len()].join(", ");
        let workspace_id = node.workspace_id.to_string();

        let edge_sql = format!(
            "DELETE FROM node_edges
             WHERE workspace_id = ?
               AND (from_node_id IN ({0}) OR to_node_id IN ({0}))",
            placeholders
        );
        let mut edge_params = Vec::with_capacity(1 + subtree_node_id_strings.len() * 2);
        edge_params.push(workspace_id.clone());
        edge_params.extend(subtree_node_id_strings.iter().cloned());
        edge_params.extend(subtree_node_id_strings.iter().cloned());
        self.conn.execute(&edge_sql, params_from_iter(edge_params.iter()))?;

        let candidate_sql = format!(
            "DELETE FROM node_generation_candidates WHERE base_node_id IN ({})",
            placeholders
        );
        self.conn.execute(&candidate_sql, params_from_iter(subtree_node_id_strings.iter()))?;

        let snapshot_sql = format!(
            "DELETE FROM node_context_snapshots WHERE node_id IN ({})",
            placeholders
        );
        self.conn.execute(&snapshot_sql, params_from_iter(subtree_node_id_strings.iter()))?;

        let hierarchy_sql = format!(
            "DELETE FROM node_hierarchy
             WHERE workspace_id = ?
               AND (child_node_id IN ({0}) OR parent_node_id IN ({0}))",
            placeholders
        );
        let mut hierarchy_params = Vec::with_capacity(1 + subtree_node_id_strings.len() * 2);
        hierarchy_params.push(workspace_id.clone());
        hierarchy_params.extend(subtree_node_id_strings.iter().cloned());
        hierarchy_params.extend(subtree_node_id_strings.iter().cloned());
        self.conn.execute(&hierarchy_sql, params_from_iter(hierarchy_params.iter()))?;

        let node_sql = format!(
            "DELETE FROM nodes WHERE workspace_id = ? AND id IN ({})",
            placeholders
        );
        let mut node_params = Vec::with_capacity(1 + subtree_node_id_strings.len());
        node_params.push(workspace_id);
        node_params.extend(subtree_node_id_strings);
        self.conn.execute(&node_sql, params_from_iter(node_params.iter()))?;

        Ok((parent_node_id, false))
    }

    pub fn create_node(&self, input: CreateNodeInput) -> Result<Node> {
        let id = Uuid::new_v4();
        let now = Utc::now();
        
        self.conn.execute(
            "INSERT INTO nodes (id, workspace_id, title, summary, body, status, created_by_type, created_at, updated_at) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            (
                &id.to_string(), 
                &input.workspace_id.to_string(), 
                &input.title, 
                &input.summary, 
                &input.body, 
                &input.status, 
                &input.created_by_type, 
                &now, 
                &now
            ),
        )?;

        if let Some(parent_id) = input.parent_node_id {
            let pos: f64 = self.conn.query_row(
                "SELECT COALESCE(MAX(position), 0.0) FROM node_hierarchy WHERE parent_node_id = ?1",
                [&parent_id.to_string()],
                |row| row.get(0),
            ).unwrap_or(0.0) + 1.0;

            self.conn.execute(
                "INSERT INTO node_hierarchy (id, workspace_id, parent_node_id, child_node_id, position) VALUES (?1, ?2, ?3, ?4, ?5)",
                (
                    &Uuid::new_v4().to_string(),
                    &input.workspace_id.to_string(),
                    &parent_id.to_string(),
                    &id.to_string(),
                    &pos
                ),
            )?;
        } else {
            self.conn.execute(
                "UPDATE workspaces SET root_node_id = ?1 WHERE id = ?2 AND root_node_id IS NULL",
                (&id.to_string(), &input.workspace_id.to_string()),
            )?;
        }

        Ok(Node {
            id,
            workspace_id: input.workspace_id,
            title: input.title,
            summary: input.summary,
            body: input.body,
            status: input.status,
            created_by_type: input.created_by_type,
            source_prompt: None,
            source_answer: None,
            created_at: now,
            updated_at: now,
        })
    }

    pub fn update_node(&self, node_id: Uuid, input: NodeUpdateInput) -> Result<Node> {
        let now = Utc::now();
        self.conn.execute(
            "UPDATE nodes SET title = ?1, summary = ?2, body = ?3, status = ?4, updated_at = ?5 WHERE id = ?6",
            (&input.title, &input.summary, &input.body, &input.status, &now, &node_id.to_string()),
        )?;
        self.get_node(node_id)
    }

    pub fn save_candidates(&self, base_node_id: Uuid, candidates: Vec<crate::models::NodeCandidateOutput>) -> Result<Vec<NodeCandidate>> {
        self.conn.execute(
            "DELETE FROM node_generation_candidates WHERE base_node_id = ?1",
            [&base_node_id.to_string()],
        )?;

        let mut saved = Vec::new();
        for c in candidates {
            let id = Uuid::new_v4();
            self.conn.execute(
                "INSERT INTO node_generation_candidates (id, base_node_id, candidate_title, candidate_summary, candidate_relation_type, candidate_mode, why_this_branch) 
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                (
                    &id.to_string(), 
                    &base_node_id.to_string(), 
                    &c.title, 
                    &c.summary, 
                    &c.relation_type, 
                    &c.mode, 
                    &c.why_this_branch
                ),
            )?;
            saved.push(NodeCandidate {
                id,
                base_node_id,
                title: c.title,
                summary: c.summary,
                relation_type: c.relation_type,
                mode: c.mode,
                why_this_branch: c.why_this_branch,
            });
        }
        Ok(saved)
    }

    pub fn list_candidates(&self, base_node_id: Uuid) -> Result<Vec<NodeCandidate>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, base_node_id, candidate_title, candidate_summary, candidate_relation_type, candidate_mode, why_this_branch 
             FROM node_generation_candidates WHERE base_node_id = ?1"
        )?;
        let rows = stmt.query_map([&base_node_id.to_string()], |row| {
            Ok(NodeCandidate {
                id: Uuid::parse_str(&row.get::<_, String>(0)?).unwrap_or_else(|_| Uuid::nil()),
                base_node_id: Uuid::parse_str(&row.get::<_, String>(1)?).unwrap_or_else(|_| Uuid::nil()),
                title: row.get(2)?,
                summary: row.get(3)?,
                relation_type: row.get(4)?,
                mode: row.get(5)?,
                why_this_branch: row.get(6)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn get_node(&self, id: Uuid) -> Result<Node> {
        self.conn.query_row(
            "SELECT id, workspace_id, title, summary, body, status, created_by_type, source_prompt, source_answer, created_at, updated_at FROM nodes WHERE id = ?1",
            [&id.to_string()],
            |row| Ok(Node {
                id: Uuid::parse_str(&row.get::<_, String>(0)?).unwrap_or_else(|_| Uuid::nil()),
                workspace_id: Uuid::parse_str(&row.get::<_, String>(1)?).unwrap_or_else(|_| Uuid::nil()),
                title: row.get(2)?,
                summary: row.get(3)?,
                body: row.get(4)?,
                status: row.get(5)?,
                created_by_type: row.get(6)?,
                source_prompt: row.get(7)?,
                source_answer: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        )
    }

    pub fn get_workspace_snapshot(&self, workspace_id: Uuid, current_node_id: Option<Uuid>) -> Result<WorkspaceSnapshot> {
        let workspace = self.conn.query_row(
            "SELECT id, name, description, root_node_id, created_at, updated_at FROM workspaces WHERE id = ?1",
            [&workspace_id.to_string()],
            |row| Ok(Workspace {
                id: Uuid::parse_str(&row.get::<_, String>(0)?).unwrap_or_else(|_| Uuid::nil()),
                name: row.get(1)?,
                description: row.get(2)?,
                root_node_id: row.get::<_, Option<String>>(3)?.and_then(|s| Uuid::parse_str(&s).ok()),
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        )?;

        let node_id = current_node_id.or(workspace.root_node_id);
        
        let current_node = if let Some(id) = node_id {
            Some(self.get_node(id)?)
        } else {
            None
        };

        let ancestors = if let Some(id) = node_id {
            self.get_ancestors(id)?
        } else {
            Vec::new()
        };

        let children = if let Some(id) = node_id {
            self.get_children(id)?
        } else {
            Vec::new()
        };

        let recent_candidates = if let Some(id) = node_id {
            self.list_candidates(id)?
        } else {
            Vec::new()
        };

        let mut edges = Vec::new();
        if let Some(node) = &current_node {
            if let Some(parent) = ancestors.last() {
                edges.push(NodeEdge {
                    id: Uuid::new_v4(),
                    from_node_id: parent.id,
                    to_node_id: node.id,
                    relation_type: "hierarchy".to_string(),
                });
            }
            for child in &children {
                edges.push(NodeEdge {
                    id: Uuid::new_v4(),
                    from_node_id: node.id,
                    to_node_id: child.id,
                    relation_type: "hierarchy".to_string(),
                });
            }
        }

        if let Some(node) = &current_node {
            let mut stmt = self.conn.prepare(
                "SELECT id, from_node_id, to_node_id, relation_type FROM node_edges 
                 WHERE from_node_id = ?1 OR to_node_id = ?1"
            )?;
            let edge_rows = stmt.query_map([&node.id.to_string()], |row| {
                Ok(NodeEdge {
                    id: Uuid::parse_str(&row.get::<_, String>(0)?).unwrap_or_else(|_| Uuid::nil()),
                    from_node_id: Uuid::parse_str(&row.get::<_, String>(1)?).unwrap_or_else(|_| Uuid::nil()),
                    to_node_id: Uuid::parse_str(&row.get::<_, String>(2)?).unwrap_or_else(|_| Uuid::nil()),
                    relation_type: row.get(3)?,
                })
            })?;
            for edge in edge_rows {
                edges.push(edge?);
            }
        }

        Ok(WorkspaceSnapshot {
            workspace,
            current_node,
            ancestors,
            children,
            edges,
            recent_candidates,
        })
    }

    pub fn search_nodes(&self, workspace_id: Uuid, query: &str) -> Result<Vec<Node>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, workspace_id, title, summary, body, status, created_by_type, source_prompt, source_answer, created_at, updated_at 
             FROM nodes WHERE workspace_id = ?1 AND (title LIKE ?2 OR summary LIKE ?2 OR body LIKE ?2)
             LIMIT 50"
        )?;
        let pattern = format!("%{}%", query);
        let rows = stmt.query_map([workspace_id.to_string(), pattern], |row| {
            Ok(Node {
                id: Uuid::parse_str(&row.get::<_, String>(0)?).unwrap_or_else(|_| Uuid::nil()),
                workspace_id: Uuid::parse_str(&row.get::<_, String>(1)?).unwrap_or_else(|_| Uuid::nil()),
                title: row.get(2)?,
                summary: row.get(3)?,
                body: row.get(4)?,
                status: row.get(5)?,
                created_by_type: row.get(6)?,
                source_prompt: row.get(7)?,
                source_answer: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn get_full_graph(&self, workspace_id: Uuid) -> Result<(Vec<Node>, Vec<NodeEdge>)> {
        let mut stmt_nodes = self.conn.prepare("SELECT id, workspace_id, title, summary, body, status, created_by_type, source_prompt, source_answer, created_at, updated_at FROM nodes WHERE workspace_id = ?1")?;
        let node_rows = stmt_nodes.query_map([workspace_id.to_string()], |row| {
            Ok(Node {
                id: Uuid::parse_str(&row.get::<_, String>(0)?).unwrap_or_else(|_| Uuid::nil()),
                workspace_id: Uuid::parse_str(&row.get::<_, String>(1)?).unwrap_or_else(|_| Uuid::nil()),
                title: row.get(2)?,
                summary: row.get(3)?,
                body: row.get(4)?,
                status: row.get(5)?,
                created_by_type: row.get(6)?,
                source_prompt: row.get(7)?,
                source_answer: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })?;

        let mut nodes = Vec::new();
        for n in node_rows { nodes.push(n?); }

        let mut stmt_edges = self.conn.prepare("SELECT id, from_node_id, to_node_id, relation_type FROM node_edges WHERE workspace_id = ?1")?;
        let edge_rows = stmt_edges.query_map([workspace_id.to_string()], |row| {
            Ok(NodeEdge {
                id: Uuid::parse_str(&row.get::<_, String>(0)?).unwrap_or_else(|_| Uuid::nil()),
                from_node_id: Uuid::parse_str(&row.get::<_, String>(1)?).unwrap_or_else(|_| Uuid::nil()),
                to_node_id: Uuid::parse_str(&row.get::<_, String>(2)?).unwrap_or_else(|_| Uuid::nil()),
                relation_type: row.get(3)?,
            })
        })?;

        let mut edges = Vec::new();
        for e in edge_rows { edges.push(e?); }

        // Also add hierarchy edges
        let mut stmt_hier = self.conn.prepare("SELECT parent_node_id, child_node_id FROM node_hierarchy WHERE workspace_id = ?1")?;
        let hier_rows = stmt_hier.query_map([workspace_id.to_string()], |row| {
            let p_id_opt: Option<String> = row.get(0)?;
            let c_id: String = row.get(1)?;
            Ok((p_id_opt, c_id))
        })?;

        for h in hier_rows {
            let (p_opt, c) = h?;
            if let Some(p) = p_opt {
                edges.push(NodeEdge {
                    id: Uuid::new_v4(),
                    from_node_id: Uuid::parse_str(&p).unwrap_or_else(|_| Uuid::nil()),
                    to_node_id: Uuid::parse_str(&c).unwrap_or_else(|_| Uuid::nil()),
                    relation_type: "hierarchy".to_string(),
                });
            }
        }

        Ok((nodes, edges))
    }

    fn get_ancestors(&self, node_id: Uuid) -> Result<Vec<Node>> {
        let mut ancestors = Vec::new();
        let mut curr = node_id;
        
        while let Ok(parent_id_str) = self.conn.query_row(
            "SELECT parent_node_id FROM node_hierarchy WHERE child_node_id = ?1",
            [&curr.to_string()],
            |row| row.get::<_, Option<String>>(0),
        ) {
            if let Some(p_id_str) = parent_id_str {
                let p_id = Uuid::parse_str(&p_id_str).unwrap_or_else(|_| Uuid::nil());
                ancestors.push(self.get_node(p_id)?);
                curr = p_id;
            } else {
                break;
            }
        }
        ancestors.reverse();
        Ok(ancestors)
    }

    fn get_children(&self, node_id: Uuid) -> Result<Vec<Node>> {
        let mut stmt = self.conn.prepare(
            "SELECT n.id, n.workspace_id, n.title, n.summary, n.body, n.status, n.created_by_type, n.source_prompt, n.source_answer, n.created_at, n.updated_at 
             FROM nodes n 
             JOIN node_hierarchy h ON n.id = h.child_node_id 
             WHERE h.parent_node_id = ?1 
             ORDER BY h.position"
        )?;
        
        let rows = stmt.query_map([&node_id.to_string()], |row| {
            Ok(Node {
                id: Uuid::parse_str(&row.get::<_, String>(0)?).unwrap_or_else(|_| Uuid::nil()),
                workspace_id: Uuid::parse_str(&row.get::<_, String>(1)?).unwrap_or_else(|_| Uuid::nil()),
                title: row.get(2)?,
                summary: row.get(3)?,
                body: row.get(4)?,
                status: row.get(5)?,
                created_by_type: row.get(6)?,
                source_prompt: row.get(7)?,
                source_answer: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })?;

        let mut children = Vec::new();
        for row in rows {
            children.push(row?);
        }
        Ok(children)
    }

    fn collect_subtree_node_ids(&self, node_id: Uuid) -> Result<Vec<Uuid>> {
        let mut stmt = self.conn.prepare(
            "WITH RECURSIVE subtree(id) AS (
                SELECT ?1
                UNION ALL
                SELECT h.child_node_id
                FROM node_hierarchy h
                JOIN subtree s ON h.parent_node_id = s.id
            )
            SELECT id FROM subtree"
        )?;

        let rows = stmt.query_map([node_id.to_string()], |row| {
            let raw_id: String = row.get(0)?;
            Ok(Uuid::parse_str(&raw_id).unwrap_or_else(|_| Uuid::nil()))
        })?;

        let mut ids = Vec::new();
        for row in rows {
            ids.push(row?);
        }
        Ok(ids)
    }
}
