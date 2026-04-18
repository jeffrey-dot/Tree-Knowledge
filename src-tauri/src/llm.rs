use async_trait::async_trait;
use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    errors::{AppError, AppResult},
    models::{
        CandidateDraft, ContextSnapshot, DirectNodeDraft, NodeRecord, ProviderMetadata,
        RootNodeDraft,
    },
    providers::ProviderStore,
};

#[async_trait]
pub trait NodeGenerator: Send + Sync {
    async fn generate_root_node(&self, question: &str) -> AppResult<RootNodeDraft>;
    async fn generate_candidates(
        &self,
        current: &NodeRecord,
        ancestors: &[NodeRecord],
        related: &[crate::models::RelatedNode],
        query: &str,
    ) -> AppResult<Vec<CandidateDraft>>;
    async fn generate_direct_node(
        &self,
        current: &NodeRecord,
        ancestors: &[NodeRecord],
        related: &[crate::models::RelatedNode],
        query: &str,
    ) -> AppResult<DirectNodeDraft>;
    async fn generate_context_snapshot(
        &self,
        current: &NodeRecord,
        ancestors: &[NodeRecord],
    ) -> AppResult<ContextSnapshot>;
    async fn test_provider_connection(&self, provider_id: Uuid) -> AppResult<ProviderHealth>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderHealth {
    pub ok: bool,
    pub checked_at: chrono::DateTime<chrono::Utc>,
    pub message: String,
}

#[derive(Clone)]
pub struct OpenAiCompatibleGenerator {
    client: reqwest::Client,
    providers: ProviderStore,
}

impl OpenAiCompatibleGenerator {
    pub fn new(providers: ProviderStore) -> Self {
        Self {
            client: reqwest::Client::new(),
            providers,
        }
    }

    async fn send_prompt<T: for<'de> Deserialize<'de>>(
        &self,
        provider: &ProviderMetadata,
        api_key: &str,
        system_prompt: &str,
        user_prompt: &str,
    ) -> AppResult<T> {
        let url = format!(
            "{}/chat/completions",
            provider.base_url.trim_end_matches('/')
        );
        let response = self
            .client
            .post(url)
            .bearer_auth(api_key)
            .json(&ChatCompletionRequest {
                model: provider.default_model.clone(),
                temperature: 0.2,
                messages: vec![
                    ChatMessage {
                        role: "system".into(),
                        content: system_prompt.into(),
                    },
                    ChatMessage {
                        role: "user".into(),
                        content: user_prompt.into(),
                    },
                ],
            })
            .send()
            .await?;

        let status = response.status();
        if status != StatusCode::OK {
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::External(format!(
                "provider request failed: {} {}",
                status, body
            )));
        }

        let payload: ChatCompletionResponse = response.json().await?;
        let content = payload
            .choices
            .into_iter()
            .next()
            .map(|choice| choice.message.content)
            .ok_or_else(|| AppError::External("provider returned no choices".into()))?;

        let json = extract_json(&content)?;
        Ok(serde_json::from_str(&json)?)
    }
}

#[async_trait]
impl NodeGenerator for OpenAiCompatibleGenerator {
    async fn generate_root_node(&self, question: &str) -> AppResult<RootNodeDraft> {
        let (provider, api_key) = self.providers.get_active_with_secret().await?;
        self.send_prompt(
            &provider,
            &api_key,
            "你是 Tree Knowledge 的根节点生成器。只输出 JSON，不要输出 Markdown，不要解释。",
            &format!(
                "请围绕用户的问题生成一个根节点。输出 JSON：{{\"title\":\"...\",\"summary\":\"...\",\"body\":\"...\"}}\n\n用户问题：{}",
                question
            ),
        )
        .await
    }

    async fn generate_candidates(
        &self,
        current: &NodeRecord,
        ancestors: &[NodeRecord],
        related: &[crate::models::RelatedNode],
        query: &str,
    ) -> AppResult<Vec<CandidateDraft>> {
        let (provider, api_key) = self.providers.get_active_with_secret().await?;
        #[derive(Deserialize)]
        struct Wrapper {
            candidates: Vec<CandidateDraft>,
        }

        let payload: Wrapper = self
            .send_prompt(
                &provider,
                &api_key,
                "你是 Tree Knowledge 的候选节点生成器。只输出 JSON，不要带代码块。",
                &format!(
                    "任务模式：candidate\n当前节点标题：{}\n当前节点摘要：{}\n祖先摘要：{}\n相关节点：{}\n用户问题：{}\n\n输出 JSON：{{\"candidates\":[{{\"title\":\"...\",\"summary\":\"...\",\"mode\":\"child|branch|related\",\"suggested_relation_type\":\"related_to|supports|contrasts|example_of|depends_on\",\"why_this_branch\":\"...\"}}]}}，候选数量 3 到 5。",
                    current.title,
                    current.summary,
                    join_node_briefs(ancestors),
                    join_related_briefs(related),
                    query
                ),
            )
            .await?;
        Ok(payload.candidates)
    }

    async fn generate_direct_node(
        &self,
        current: &NodeRecord,
        ancestors: &[NodeRecord],
        related: &[crate::models::RelatedNode],
        query: &str,
    ) -> AppResult<DirectNodeDraft> {
        let (provider, api_key) = self.providers.get_active_with_secret().await?;
        #[derive(Deserialize)]
        struct Wrapper {
            node: DirectNodeDraft,
        }

        let payload: Wrapper = self
            .send_prompt(
                &provider,
                &api_key,
                "你是 Tree Knowledge 的直接节点生成器。只输出 JSON，不要带代码块。",
                &format!(
                    "任务模式：direct\n当前节点标题：{}\n当前节点摘要：{}\n祖先摘要：{}\n相关节点：{}\n用户问题：{}\n\n输出 JSON：{{\"node\":{{\"reasoning\":\"...\",\"title\":\"...\",\"summary\":\"...\",\"body\":\"...\",\"mode\":\"child|branch|related\",\"suggested_relation_type\":\"related_to|supports|contrasts|example_of|depends_on\"}}}}。",
                    current.title,
                    current.summary,
                    join_node_briefs(ancestors),
                    join_related_briefs(related),
                    query
                ),
            )
            .await?;
        Ok(payload.node)
    }

    async fn generate_context_snapshot(
        &self,
        current: &NodeRecord,
        ancestors: &[NodeRecord],
    ) -> AppResult<ContextSnapshot> {
        let body_excerpt = trim_text(&current.body, 220);
        Ok(ContextSnapshot {
            context_summary: if current.summary.trim().is_empty() {
                body_excerpt.clone()
            } else {
                current.summary.clone()
            },
            ancestor_summary: if ancestors.is_empty() {
                String::new()
            } else {
                join_node_briefs(ancestors)
            },
        })
    }

    async fn test_provider_connection(&self, provider_id: Uuid) -> AppResult<ProviderHealth> {
        let provider = self.providers.get(provider_id)?;
        let api_key = self.providers.get_api_key(provider_id).await?;
        let response = self
            .client
            .get(format!(
                "{}/models",
                provider.base_url.trim_end_matches('/')
            ))
            .bearer_auth(api_key)
            .send()
            .await?;

        let ok = response.status().is_success();
        Ok(ProviderHealth {
            ok,
            checked_at: chrono::Utc::now(),
            message: if ok {
                "provider reachable".into()
            } else {
                format!("provider returned {}", response.status())
            },
        })
    }
}

fn join_node_briefs(nodes: &[NodeRecord]) -> String {
    nodes
        .iter()
        .map(|item| format!("{}: {}", item.title, trim_text(&item.summary, 80)))
        .collect::<Vec<_>>()
        .join(" / ")
}

fn join_related_briefs(nodes: &[crate::models::RelatedNode]) -> String {
    nodes
        .iter()
        .map(|item| {
            format!(
                "{} [{}]: {}",
                item.title,
                item.relation_type.to_string(),
                trim_text(&item.summary, 60)
            )
        })
        .collect::<Vec<_>>()
        .join(" / ")
}

fn trim_text(value: &str, limit: usize) -> String {
    let trimmed = value.trim();
    if trimmed.chars().count() <= limit {
        trimmed.to_string()
    } else {
        trimmed.chars().take(limit).collect::<String>() + "..."
    }
}

fn extract_json(content: &str) -> AppResult<String> {
    let trimmed = content.trim();
    if trimmed.starts_with('{') {
        return Ok(trimmed.to_string());
    }

    if let Some(start) = trimmed.find('{') {
        if let Some(end) = trimmed.rfind('}') {
            return Ok(trimmed[start..=end].to_string());
        }
    }

    Err(AppError::External(
        "provider did not return valid JSON content".into(),
    ))
}

#[derive(Debug, Serialize)]
struct ChatCompletionRequest {
    model: String,
    temperature: f32,
    messages: Vec<ChatMessage>,
}

#[derive(Debug, Serialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    message: ChatResponseMessage,
}

#[derive(Debug, Deserialize)]
struct ChatResponseMessage {
    content: String,
}

#[cfg(test)]
mod tests {
    use super::extract_json;

    #[test]
    fn extracts_json_from_markdown_wrapped_content() {
        let json = extract_json("```json\n{\"title\":\"Node\"}\n```").unwrap();
        assert_eq!(json, "{\"title\":\"Node\"}");
    }
}
