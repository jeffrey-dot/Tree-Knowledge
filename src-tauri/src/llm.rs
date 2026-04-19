use crate::models::{LlmCandidatesResult, LlmGenerationResult, LlmProvider, Node};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::{AppHandle, Emitter};

pub struct LlmService {
    provider: LlmProvider,
}

#[derive(Debug, Serialize, Clone)]
pub struct LlmStreamEvent {
    pub request_id: String,
    pub operation: String,
    pub stage: String,
    pub content: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone)]
pub struct LlmStreamTarget {
    pub app: AppHandle,
    pub request_id: String,
    pub operation: String,
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

#[derive(Debug, Deserialize)]
struct OpenAIStreamResponse {
    choices: Vec<OpenAIStreamChoice>,
}

#[derive(Debug, Deserialize)]
struct OpenAIStreamChoice {
    delta: OpenAIStreamDelta,
}

#[derive(Debug, Deserialize)]
struct OpenAIStreamDelta {
    content: Option<serde_json::Value>,
}

impl LlmService {
    pub fn new(provider: LlmProvider) -> Self {
        LlmService { provider }
    }

    pub async fn generate_root_node_with_stream(
        &self,
        question: &str,
        stream_target: Option<LlmStreamTarget>,
    ) -> Result<LlmGenerationResult, String> {
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

        self.call_openai_generic::<LlmGenerationResult>(&prompt, stream_target)
            .await
    }

    pub async fn expand_node_with_stream(
        &self,
        current_node: &Node,
        query: &str,
        stream_target: Option<LlmStreamTarget>,
    ) -> Result<LlmGenerationResult, String> {
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

        self.call_openai_generic::<LlmGenerationResult>(&prompt, stream_target)
            .await
    }

    pub async fn generate_candidates_with_stream(
        &self,
        current_node: &Node,
        query: &str,
        stream_target: Option<LlmStreamTarget>,
    ) -> Result<LlmCandidatesResult, String> {
        let prompt = format!(
            "You are a knowledge exploration assistant. 
            
            CURRENT NODE:
            Title: {}
            Summary: {}
            
            USER INTENT: {}
            
            Suggest 3-5 distinct directions to expand this knowledge tree.
            
            RESPONSE FORMAT (JSON):
            {{
              \"candidates\": [
                {{
                  \"title\": \"Short descriptive title\",
                  \"summary\": \"Brief 1-sentence overview\",
                  \"relation_type\": \"related_to\",
                  \"mode\": \"child\",
                  \"why_this_branch\": \"Brief explanation of value\"
                }}
              ]
            }}
            
            Return ONLY the JSON object.",
            current_node.title,
            current_node.summary.as_deref().unwrap_or(""),
            query
        );

        self.call_openai_generic::<LlmCandidatesResult>(&prompt, stream_target)
            .await
    }

    async fn call_openai_generic<T: for<'de> serde::Deserialize<'de>>(
        &self,
        prompt: &str,
        stream_target: Option<LlmStreamTarget>,
    ) -> Result<T, String> {
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
            "response_format": { "type": "json_object" },
            "stream": stream_target.is_some()
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

        let content = if let Some(target) = stream_target {
            self.emit_stream_event(
                &target,
                "start",
                None,
                None,
            );

            match self.read_streaming_response(res, &target).await {
                Ok(content) => {
                    self.emit_stream_event(&target, "done", None, None);
                    content
                }
                Err(error) => {
                    self.emit_stream_event(&target, "error", None, Some(error.clone()));
                    return Err(error);
                }
            }
        } else {
            let api_res: OpenAIResponse = res.json().await.map_err(|e| e.to_string())?;
            api_res
                .choices
                .first()
                .ok_or("No response from AI")?
                .message
                .content
                .clone()
        };

        let result: T = serde_json::from_str(&content).map_err(|e| {
            format!("Failed to parse AI response as JSON: {}. Content: {}", e, content)
        })?;

        Ok(result)
    }

    async fn read_streaming_response(
        &self,
        mut res: reqwest::Response,
        target: &LlmStreamTarget,
    ) -> Result<String, String> {
        let mut buffer = String::new();
        let mut content = String::new();

        while let Some(chunk) = res.chunk().await.map_err(|e| e.to_string())? {
            let chunk_text = String::from_utf8_lossy(&chunk).replace("\r\n", "\n");
            buffer.push_str(&chunk_text);

            while let Some(event_end) = buffer.find("\n\n") {
                let event_block = buffer[..event_end].to_string();
                buffer.drain(..event_end + 2);

                if let Some(delta) = Self::parse_stream_event(&event_block)? {
                    content.push_str(&delta);
                    self.emit_stream_event(target, "delta", Some(delta), None);
                }
            }
        }

        let trailing = buffer.trim();
        if !trailing.is_empty() {
            if let Some(delta) = Self::parse_stream_event(trailing)? {
                content.push_str(&delta);
                self.emit_stream_event(target, "delta", Some(delta), None);
            }
        }

        if content.is_empty() {
            return Err("No streamed content received from AI".to_string());
        }

        Ok(content)
    }

    fn parse_stream_event(event_block: &str) -> Result<Option<String>, String> {
        for raw_line in event_block.lines() {
            let line = raw_line.trim();
            let data = line
                .strip_prefix("data: ")
                .or_else(|| line.strip_prefix("data:"));

            let Some(data) = data else {
                continue;
            };

            if data == "[DONE]" {
                return Ok(None);
            }

            let parsed: OpenAIStreamResponse =
                serde_json::from_str(data).map_err(|error| error.to_string())?;

            let Some(choice) = parsed.choices.first() else {
                continue;
            };

            if let Some(delta) = Self::extract_delta_text(&choice.delta.content) {
                return Ok(Some(delta));
            }
        }

        Ok(None)
    }

    fn extract_delta_text(content: &Option<serde_json::Value>) -> Option<String> {
        match content {
            Some(serde_json::Value::String(text)) if !text.is_empty() => Some(text.clone()),
            Some(serde_json::Value::Array(parts)) => {
                let joined = parts
                    .iter()
                    .filter_map(|part| part.get("text").and_then(serde_json::Value::as_str))
                    .collect::<String>();

                if joined.is_empty() {
                    None
                } else {
                    Some(joined)
                }
            }
            _ => None,
        }
    }

    fn emit_stream_event(
        &self,
        target: &LlmStreamTarget,
        stage: &str,
        content: Option<String>,
        error: Option<String>,
    ) {
        let payload = LlmStreamEvent {
            request_id: target.request_id.clone(),
            operation: target.operation.clone(),
            stage: stage.to_string(),
            content,
            error,
        };

        let _ = target.app.emit("llm-stream", payload);
    }
}
