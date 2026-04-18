mod db;
mod models;
mod llm;

use std::sync::Mutex;
use tauri::{Manager, State};
use db::DbManager;
use models::{
    Workspace, CreateWorkspaceInput, Node, CreateNodeInput, 
    WorkspaceSnapshot, LlmProvider, CreateProviderInput
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
    
    let node = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.create_node(CreateNodeInput {
            workspace_id,
            title: result.title,
            summary: Some(result.summary),
            body: Some(result.body),
            parent_node_id: None,
            status: "confirmed".to_string(),
            created_by_type: "ai".to_string(),
        }).map_err(|e: rusqlite::Error| e.to_string())?
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
            expand_node_with_ai
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
