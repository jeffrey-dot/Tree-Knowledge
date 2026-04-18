use crate::models::{LlmProvider, LlmGenerationResult, Node};
use serde::{Deserialize, Serialize};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde_json::json;

pub struct LlmService {
    provider: LlmProvider,
}

#[derive(Debug, Deserialize)]
struct OpenAIResponse {
    choices: Vec<OpenAIChoice>,
}

#[derive(Debug, Deserialize)]
struct OpenAIChoice {
    message: OpenAIMessage,
}

#[derive(Debug, Deserialize)]
struct OpenAIMessage {
    content: String,
}

impl LlmService {
    pub fn new(provider: LlmProvider) -> Self {
        LlmService { provider }
    }

    pub async fn generate_root_node(&self, question: &str) -> Result<LlmGenerationResult, String> {
        let prompt = format!(
            "You are a knowledge exploration assistant. Based on the user's initial question, create a structured root knowledge node.
            
            USER QUESTION: {}
            
            RESPONSE FORMAT (JSON):
            {{
              \"title\": \"Short descriptive title\",
              \"summary\": \"1-2 sentence overview\",
              \"body\": \"Detailed explanation in Markdown\"
            }}
            
            Return ONLY the JSON object.",
            question
        );

        self.call_openai(&prompt).await
    }

    pub async fn expand_node(&self, current_node: &Node, query: &str) -> Result<LlmGenerationResult, String> {
        let prompt = format!(
            "You are expanding a knowledge tree.
            
            CURRENT NODE:
            Title: {}
            Summary: {}
            Content: {}
            
            USER REQUEST: {}
            
            Based on the current node and the user request, generate a new sub-node.
            
            RESPONSE FORMAT (JSON):
            {{
              \"title\": \"Short descriptive title\",
              \"summary\": \"1-2 sentence overview\",
              \"body\": \"Detailed explanation in Markdown\"
            }}
            
            Return ONLY the JSON object.",
            current_node.title,
            current_node.summary.as_deref().unwrap_or(""),
            current_node.body.as_deref().unwrap_or(""),
            query
        );

        self.call_openai(&prompt).await
    }

    async fn call_openai(&self, prompt: &str) -> Result<LlmGenerationResult, String> {
        let client = reqwest::Client::new();
        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {}", self.provider.api_key))
                .map_err(|e| e.to_string())?,
        );

        let body = json!({
            "model": self.provider.default_model,
            "messages": [
                {"role": "system", "content": "You are a helpful assistant that always outputs valid JSON."},
                {"role": "user", "content": prompt}
            ],
            "response_format": { "type": "json_object" }
        });

        let res = client
            .post(&format!("{}/chat/completions", self.provider.base_url))
            .headers(headers)
            .json(&body)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !res.status().is_success() {
            let status = res.status();
            let err_text = res.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(format!("API Error ({}): {}", status, err_text));
        }

        let api_res: OpenAIResponse = res.json().await.map_err(|e| e.to_string())?;
        let content = api_res
            .choices
            .first()
            .ok_or("No response from AI")?
            .message
            .content
            .clone();

        let result: LlmGenerationResult = serde_json::from_str(&content).map_err(|e| {
            format!("Failed to parse AI response as JSON: {}. Content: {}", e, content)
        })?;

        Ok(result)
    }
}
