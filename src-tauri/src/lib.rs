mod db;
mod models;
mod llm;

use std::sync::Mutex;
use tauri::{Manager, State};
use db::DbManager;
use models::{
    Workspace, CreateWorkspaceInput, Node, CreateNodeInput, 
    WorkspaceSnapshot, LlmProvider, CreateProviderInput, NodeUpdateInput,
    NodeCandidate, FullGraph
};
use llm::LlmService;
use uuid::Uuid;

struct AppState {
    db: Mutex<DbManager>,
}

#[tauri::command]
async fn list_providers(state: State<'_, AppState>) -> Result<Vec<LlmProvider>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.list_providers().map_err(|e: rusqlite::Error| e.to_string())
}

#[tauri::command]
async fn create_provider(state: State<'_, AppState>, input: CreateProviderInput) -> Result<LlmProvider, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.create_provider(input).map_err(|e: rusqlite::Error| e.to_string())
}

#[tauri::command]
async fn generate_root_node(
    state: State<'_, AppState>, 
    workspace_id: Uuid, 
    question: String
) -> Result<Node, String> {
    let provider = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.get_active_provider()
            .map_err(|e: rusqlite::Error| e.to_string())?
            .ok_or("No active LLM provider configured. Please go to settings.")?
    };
    
    let llm = LlmService::new(provider);
    let result = llm.generate_root_node(&question).await?;
    
    let (node, workspace_name) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        
        // 1. Rename the workspace to the AI-generated title
        db.update_workspace_name(workspace_id, result.title.clone()).map_err(|e| e.to_string())?;

        // 2. Create the root node
        let n = db.create_node(CreateNodeInput {
            workspace_id,
            title: result.title.clone(),
            summary: Some(result.summary),
            body: Some(result.body),
            parent_node_id: None,
            status: "confirmed".to_string(),
            created_by_type: "ai".to_string(),
        }).map_err(|e: rusqlite::Error| e.to_string())?;

        (n, result.title)
    };

    Ok(node)
}

#[tauri::command]
async fn expand_node_with_ai(
    state: State<'_, AppState>, 
    workspace_id: Uuid, 
    parent_node_id: Uuid,
    query: String
) -> Result<Node, String> {
    let (provider, current_node) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let p = db.get_active_provider()
            .map_err(|e: rusqlite::Error| e.to_string())?
            .ok_or("No active LLM provider configured. Please go to settings.")?;
        let n = db.get_node(parent_node_id).map_err(|e: rusqlite::Error| e.to_string())?;
        (p, n)
    };
    
    let llm = LlmService::new(provider);
    let result = llm.expand_node(&current_node, &query).await?;
    
    let node = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.create_node(CreateNodeInput {
            workspace_id,
            title: result.title,
            summary: Some(result.summary),
            body: Some(result.body),
            parent_node_id: Some(parent_node_id),
            status: "confirmed".to_string(),
            created_by_type: "ai".to_string(),
        }).map_err(|e: rusqlite::Error| e.to_string())?
    };

    Ok(node)
}

#[tauri::command]
async fn generate_candidates(
    state: State<'_, AppState>,
    _workspace_id: Uuid,
    node_id: Uuid,
    query: String
) -> Result<Vec<NodeCandidate>, String> {
    let (provider, current_node) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let p = db.get_active_provider()
            .map_err(|e: rusqlite::Error| e.to_string())?
            .ok_or("No active LLM provider configured.")?;
        let n = db.get_node(node_id).map_err(|e: rusqlite::Error| e.to_string())?;
        (p, n)
    };

    let llm = LlmService::new(provider);
    let result = llm.generate_candidates(&current_node, &query).await?;

    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.save_candidates(node_id, result.candidates).map_err(|e: rusqlite::Error| e.to_string())
}

#[tauri::command]
async fn accept_candidate(
    state: State<'_, AppState>,
    candidate_id: Uuid,
    query: String
) -> Result<Node, String> {
    let (candidate, provider, base_node) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        
        let cand = db.conn.query_row(
            "SELECT id, base_node_id, candidate_title, candidate_summary, candidate_relation_type, candidate_mode, why_this_branch FROM node_generation_candidates WHERE id = ?1",
            [&candidate_id.to_string()],
            |row| Ok(NodeCandidate {
                id: Uuid::parse_str(&row.get::<_, String>(0)?).unwrap_or_else(|_| Uuid::nil()),
                base_node_id: Uuid::parse_str(&row.get::<_, String>(1)?).unwrap_or_else(|_| Uuid::nil()),
                title: row.get(2)?,
                summary: row.get(3)?,
                relation_type: row.get(4)?,
                mode: row.get(5)?,
                why_this_branch: row.get(6)?,
            })
        ).map_err(|e| e.to_string())?;

        let p = db.get_active_provider()
            .map_err(|e: rusqlite::Error| e.to_string())?
            .ok_or("No active LLM provider.")?;
            
        let n = db.get_node(cand.base_node_id).map_err(|e: rusqlite::Error| e.to_string())?;
        (cand, p, n)
    };

    let llm = LlmService::new(provider);
    let prompt = format!("Focus Title: {}\nFocus Summary: {}\nContext: {}", candidate.title, candidate.summary, query);
    let result = llm.expand_node(&base_node, &prompt).await?;

    let node = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let n = db.create_node(CreateNodeInput {
            workspace_id: base_node.workspace_id,
            title: result.title,
            summary: Some(result.summary),
            body: Some(result.body),
            parent_node_id: Some(candidate.base_node_id),
            status: "confirmed".to_string(),
            created_by_type: "ai".to_string(),
        }).map_err(|e: rusqlite::Error| e.to_string())?;
        
        db.conn.execute("DELETE FROM node_generation_candidates WHERE id = ?1", [&candidate_id.to_string()]).map_err(|e| e.to_string())?;
        n
    };

    Ok(node)
}

#[tauri::command]
fn list_workspaces(state: State<AppState>) -> Result<Vec<Workspace>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.list_workspaces().map_err(|e: rusqlite::Error| e.to_string())
}

#[tauri::command]
fn create_workspace(state: State<AppState>, input: CreateWorkspaceInput) -> Result<Workspace, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.create_workspace(input).map_err(|e: rusqlite::Error| e.to_string())
}

#[tauri::command]
fn get_workspace_snapshot(state: State<AppState>, workspace_id: Uuid, current_node_id: Option<Uuid>) -> Result<WorkspaceSnapshot, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_workspace_snapshot(workspace_id, current_node_id).map_err(|e: rusqlite::Error| e.to_string())
}

#[tauri::command]
fn update_node(state: State<AppState>, node_id: Uuid, input: NodeUpdateInput) -> Result<Node, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.update_node(node_id, input).map_err(|e: rusqlite::Error| e.to_string())
}

#[tauri::command]
fn create_edge(state: State<AppState>, workspace_id: Uuid, from_node_id: Uuid, to_node_id: Uuid, relation_type: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.conn.execute(
        "INSERT OR IGNORE INTO node_edges (id, workspace_id, from_node_id, to_node_id, relation_type, created_by_type) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        (&Uuid::new_v4().to_string(), &workspace_id.to_string(), &from_node_id.to_string(), &to_node_id.to_string(), &relation_type, "user")
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_edge(state: State<AppState>, edge_id: Uuid) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.conn.execute("DELETE FROM node_edges WHERE id = ?1", [&edge_id.to_string()]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn search_nodes(state: State<AppState>, workspace_id: Uuid, query: String) -> Result<Vec<Node>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.search_nodes(workspace_id, &query).map_err(|e: rusqlite::Error| e.to_string())
}

#[tauri::command]
fn get_full_graph(state: State<AppState>, workspace_id: Uuid) -> Result<FullGraph, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let (nodes, edges) = db.get_full_graph(workspace_id).map_err(|e: rusqlite::Error| e.to_string())?;
    Ok(FullGraph { nodes, edges })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir().expect("Failed to get app data dir");
            let db_path = app_data_dir.join("tree-knowledge.db");
            let db_manager = DbManager::new(db_path).expect("Failed to initialize database");
            app.manage(AppState {
                db: Mutex::new(db_manager),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_workspaces, 
            create_workspace, 
            get_workspace_snapshot,
            list_providers,
            create_provider,
            generate_root_node,
            expand_node_with_ai,
            update_node,
            generate_candidates,
            accept_candidate,
            create_edge,
            delete_edge,
            search_nodes,
            get_full_graph
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
