mod db;
mod errors;
mod llm;
mod models;
mod providers;
mod services;

use std::sync::Arc;

use models::{
    CreateEdgeInput, CreateRootNodeInput, CreateWorkspaceInput, ExpandNodeInput,
    GenerateCandidatesInput, MoveNodeInput, SaveProviderInput, SearchNodesInput, UpdateNodeInput,
};
use services::AppServices;
use tauri::Manager;
use uuid::Uuid;

type SharedServices = Arc<AppServices>;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .map_err(|error| errors::AppError::Internal(error.to_string()))?;
            let services = Arc::new(AppServices::new(data_dir)?);
            app.manage(services);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_workspaces,
            create_workspace,
            create_root_node,
            generate_candidates,
            expand_node,
            update_node,
            move_node,
            create_edge,
            get_workspace_snapshot,
            search_nodes,
            list_providers,
            save_provider,
            test_provider_connection
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command(rename_all = "camelCase")]
fn list_workspaces(state: tauri::State<'_, SharedServices>) -> Result<serde_json::Value, String> {
    state
        .list_workspaces()
        .map(|workspaces| serde_json::json!({ "workspaces": workspaces }))
        .map_err(|error| error.to_string())
}

#[tauri::command(rename_all = "camelCase")]
async fn create_workspace(
    state: tauri::State<'_, SharedServices>,
    input: CreateWorkspaceInput,
) -> Result<serde_json::Value, String> {
    state
        .create_workspace(input)
        .await
        .map(|workspace| serde_json::json!({ "workspace": workspace }))
        .map_err(|error| error.to_string())
}

#[tauri::command(rename_all = "camelCase")]
async fn create_root_node(
    state: tauri::State<'_, SharedServices>,
    input: CreateRootNodeInput,
) -> Result<serde_json::Value, String> {
    state
        .create_root_node(input)
        .await
        .map(|node| serde_json::json!({ "node": node }))
        .map_err(|error| error.to_string())
}

#[tauri::command(rename_all = "camelCase")]
async fn generate_candidates(
    state: tauri::State<'_, SharedServices>,
    node_id: Uuid,
    input: GenerateCandidatesInput,
) -> Result<serde_json::Value, String> {
    state
        .generate_candidates(node_id, input)
        .await
        .map(|candidates| serde_json::json!({ "base_node_id": node_id, "candidates": candidates }))
        .map_err(|error| error.to_string())
}

#[tauri::command(rename_all = "camelCase")]
async fn expand_node(
    state: tauri::State<'_, SharedServices>,
    node_id: Uuid,
    input: ExpandNodeInput,
) -> Result<serde_json::Value, String> {
    state
        .expand_node(node_id, input)
        .await
        .map(|(node, placement)| serde_json::json!({ "node": node, "placement": placement }))
        .map_err(|error| error.to_string())
}

#[tauri::command(rename_all = "camelCase")]
async fn update_node(
    state: tauri::State<'_, SharedServices>,
    node_id: Uuid,
    input: UpdateNodeInput,
) -> Result<serde_json::Value, String> {
    state
        .update_node(node_id, input)
        .await
        .map(|node| serde_json::json!({ "node": node }))
        .map_err(|error| error.to_string())
}

#[tauri::command(rename_all = "camelCase")]
async fn move_node(
    state: tauri::State<'_, SharedServices>,
    node_id: Uuid,
    input: MoveNodeInput,
) -> Result<serde_json::Value, String> {
    state
        .move_node(node_id, input)
        .await
        .map(|(node_id, old_parent_id, new_parent_id)| {
            serde_json::json!({
                "node_id": node_id,
                "old_parent_id": old_parent_id,
                "new_parent_id": new_parent_id
            })
        })
        .map_err(|error| error.to_string())
}

#[tauri::command(rename_all = "camelCase")]
fn create_edge(
    state: tauri::State<'_, SharedServices>,
    node_id: Uuid,
    input: CreateEdgeInput,
) -> Result<serde_json::Value, String> {
    state
        .create_edge(node_id, input.clone())
        .map(|_| {
            serde_json::json!({
                "edge": {
                    "from_node_id": node_id,
                    "to_node_id": input.target_node_id,
                    "relation_type": input.relation_type
                }
            })
        })
        .map_err(|error| error.to_string())
}

#[tauri::command(rename_all = "camelCase")]
async fn get_workspace_snapshot(
    state: tauri::State<'_, SharedServices>,
    node_id: Uuid,
) -> Result<serde_json::Value, String> {
    state
        .get_workspace_snapshot(node_id)
        .await
        .and_then(|snapshot| serde_json::to_value(snapshot).map_err(Into::into))
        .map_err(|error: errors::AppError| error.to_string())
}

#[tauri::command(rename_all = "camelCase")]
fn search_nodes(
    state: tauri::State<'_, SharedServices>,
    input: SearchNodesInput,
) -> Result<serde_json::Value, String> {
    state
        .search_nodes(input)
        .map(|items| serde_json::json!({ "items": items }))
        .map_err(|error| error.to_string())
}

#[tauri::command(rename_all = "camelCase")]
async fn list_providers(
    state: tauri::State<'_, SharedServices>,
) -> Result<serde_json::Value, String> {
    state
        .list_providers()
        .await
        .map(|providers| serde_json::json!({ "providers": providers }))
        .map_err(|error| error.to_string())
}

#[tauri::command(rename_all = "camelCase")]
async fn save_provider(
    state: tauri::State<'_, SharedServices>,
    input: SaveProviderInput,
) -> Result<serde_json::Value, String> {
    state
        .save_provider(input)
        .await
        .map(|provider| serde_json::json!({ "provider": provider }))
        .map_err(|error| error.to_string())
}

#[tauri::command(rename_all = "camelCase")]
async fn test_provider_connection(
    state: tauri::State<'_, SharedServices>,
    provider_id: Uuid,
) -> Result<serde_json::Value, String> {
    state
        .test_provider_connection(provider_id)
        .await
        .and_then(|health| serde_json::to_value(health).map_err(Into::into))
        .map_err(|error: errors::AppError| error.to_string())
}
