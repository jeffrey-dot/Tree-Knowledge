use std::{
    fs,
    path::{Path, PathBuf},
    sync::Arc,
};

use async_trait::async_trait;
use chrono::Utc;
use keyring::Entry;
use uuid::Uuid;

use crate::{
    errors::{AppError, AppResult},
    models::{ProviderMetadata, ProviderSummary, SaveProviderInput},
};

const KEYRING_SERVICE: &str = "tree-knowledge";

#[async_trait]
pub trait SecretStore: Send + Sync {
    async fn save(&self, provider_id: Uuid, api_key: &str) -> AppResult<()>;
    async fn load(&self, provider_id: Uuid) -> AppResult<Option<String>>;
}

#[derive(Clone)]
pub struct KeyringSecretStore;

#[async_trait]
impl SecretStore for KeyringSecretStore {
    async fn save(&self, provider_id: Uuid, api_key: &str) -> AppResult<()> {
        let entry = Entry::new(KEYRING_SERVICE, &provider_id.to_string())
            .map_err(|error| AppError::External(error.to_string()))?;
        entry
            .set_password(api_key)
            .map_err(|error| AppError::External(error.to_string()))?;
        Ok(())
    }

    async fn load(&self, provider_id: Uuid) -> AppResult<Option<String>> {
        let entry = Entry::new(KEYRING_SERVICE, &provider_id.to_string())
            .map_err(|error| AppError::External(error.to_string()))?;
        match entry.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(error) => Err(AppError::External(error.to_string())),
        }
    }
}

#[derive(Clone)]
pub struct FileSecretStore {
    path: PathBuf,
}

impl FileSecretStore {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }
}

#[async_trait]
impl SecretStore for FileSecretStore {
    async fn save(&self, provider_id: Uuid, api_key: &str) -> AppResult<()> {
        let mut values = read_json_map(&self.path)?;
        values.insert(provider_id.to_string(), api_key.to_string());
        write_json_map(&self.path, &values)
    }

    async fn load(&self, provider_id: Uuid) -> AppResult<Option<String>> {
        let values = read_json_map(&self.path)?;
        Ok(values.get(&provider_id.to_string()).cloned())
    }
}

#[derive(Clone)]
pub struct ProviderStore {
    metadata_path: PathBuf,
    secret_store: Arc<dyn SecretStore>,
}

impl ProviderStore {
    pub fn new(metadata_path: PathBuf, secret_store: Arc<dyn SecretStore>) -> AppResult<Self> {
        if let Some(parent) = metadata_path.parent() {
            fs::create_dir_all(parent).map_err(|error| AppError::Internal(error.to_string()))?;
        }

        if !metadata_path.exists() {
            fs::write(&metadata_path, "[]")
                .map_err(|error| AppError::Internal(error.to_string()))?;
        }

        Ok(Self {
            metadata_path,
            secret_store,
        })
    }

    pub async fn list(&self) -> AppResult<Vec<ProviderSummary>> {
        let metadata = self.read_all()?;
        let mut result = Vec::with_capacity(metadata.len());
        for item in metadata {
            let has_api_key = self.secret_store.load(item.id).await?.is_some();
            result.push(ProviderSummary {
                id: item.id,
                name: item.name,
                base_url: item.base_url,
                default_model: item.default_model,
                enabled: item.enabled,
                has_api_key,
                last_checked_at: item.last_checked_at,
                last_error: item.last_error,
            });
        }
        Ok(result)
    }

    pub fn get(&self, provider_id: Uuid) -> AppResult<ProviderMetadata> {
        self.read_all()?
            .into_iter()
            .find(|item| item.id == provider_id)
            .ok_or_else(|| AppError::NotFound("provider not found".into()))
    }

    pub async fn get_active_with_secret(&self) -> AppResult<(ProviderMetadata, String)> {
        let provider = self
            .read_all()?
            .into_iter()
            .find(|item| item.enabled)
            .ok_or_else(|| AppError::Validation("no enabled provider configured".into()))?;

        let api_key =
            self.secret_store.load(provider.id).await?.ok_or_else(|| {
                AppError::Validation("enabled provider is missing api key".into())
            })?;
        Ok((provider, api_key))
    }

    pub async fn save(&self, input: SaveProviderInput) -> AppResult<ProviderSummary> {
        let mut providers = self.read_all()?;
        let provider_id = input.id.unwrap_or_else(Uuid::new_v4);

        if input.enabled {
            for provider in &mut providers {
                provider.enabled = false;
            }
        }

        let metadata = ProviderMetadata {
            id: provider_id,
            name: input.name,
            base_url: normalize_base_url(&input.base_url),
            default_model: input.default_model,
            enabled: input.enabled,
            last_checked_at: None,
            last_error: None,
        };

        if let Some(index) = providers.iter().position(|item| item.id == provider_id) {
            providers[index] = metadata.clone();
        } else {
            providers.push(metadata.clone());
        }

        self.write_all(&providers)?;
        if !input.api_key.trim().is_empty() {
            self.secret_store.save(provider_id, &input.api_key).await?;
        }
        let has_api_key = self.secret_store.load(provider_id).await?.is_some();

        Ok(ProviderSummary {
            id: metadata.id,
            name: metadata.name,
            base_url: metadata.base_url,
            default_model: metadata.default_model,
            enabled: metadata.enabled,
            has_api_key,
            last_checked_at: metadata.last_checked_at,
            last_error: metadata.last_error,
        })
    }

    pub fn update_health(
        &self,
        provider_id: Uuid,
        last_error: Option<String>,
    ) -> AppResult<ProviderMetadata> {
        let mut providers = self.read_all()?;
        let provider = providers
            .iter_mut()
            .find(|item| item.id == provider_id)
            .ok_or_else(|| AppError::NotFound("provider not found".into()))?;

        provider.last_checked_at = Some(Utc::now());
        provider.last_error = last_error;

        let cloned = provider.clone();
        self.write_all(&providers)?;
        Ok(cloned)
    }

    pub async fn get_api_key(&self, provider_id: Uuid) -> AppResult<String> {
        self.secret_store
            .load(provider_id)
            .await?
            .ok_or_else(|| AppError::Validation("provider api key not found".into()))
    }

    fn read_all(&self) -> AppResult<Vec<ProviderMetadata>> {
        let raw = fs::read_to_string(&self.metadata_path)
            .map_err(|error| AppError::Internal(error.to_string()))?;
        Ok(serde_json::from_str(&raw)?)
    }

    fn write_all(&self, items: &[ProviderMetadata]) -> AppResult<()> {
        let raw = serde_json::to_string_pretty(items)?;
        fs::write(&self.metadata_path, raw)
            .map_err(|error| AppError::Internal(error.to_string()))?;
        Ok(())
    }
}

fn normalize_base_url(raw: &str) -> String {
    raw.trim_end_matches('/').to_string()
}

fn read_json_map(path: &Path) -> AppResult<std::collections::HashMap<String, String>> {
    if !path.exists() {
        return Ok(std::collections::HashMap::new());
    }

    let raw = fs::read_to_string(path).map_err(|error| AppError::Internal(error.to_string()))?;
    if raw.trim().is_empty() {
        return Ok(std::collections::HashMap::new());
    }
    Ok(serde_json::from_str(&raw)?)
}

fn write_json_map(path: &Path, value: &std::collections::HashMap<String, String>) -> AppResult<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| AppError::Internal(error.to_string()))?;
    }
    fs::write(path, serde_json::to_string_pretty(value)?)
        .map_err(|error| AppError::Internal(error.to_string()))?;
    Ok(())
}
