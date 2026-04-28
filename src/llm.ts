export const defaultLlmMode = "stream";

const llmSettingsStorageKey = "tree-knowledge.llm-settings";

export type LlmSettings = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export type GenerateNodeContentInput = {
  title: string;
  goal: string;
  parentTitle?: string;
  contextSummaries?: Array<{
    title: string;
    summary: string;
  }>;
};

type ChatCompletionChunk = {
  choices?: Array<{
    delta?: {
      content?: string;
    };
  }>;
};

export function getDefaultLlmSettings(): LlmSettings {
  return {
    apiKey: import.meta.env.VITE_OPENAI_API_KEY ?? "",
    baseUrl: import.meta.env.VITE_OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    model: import.meta.env.VITE_OPENAI_MODEL ?? "gpt-5.2",
  };
}

export function loadLlmSettings(): LlmSettings {
  const defaults = getDefaultLlmSettings();

  if (typeof window === "undefined") return defaults;

  const savedSettings = window.localStorage.getItem(llmSettingsStorageKey);
  if (!savedSettings) return defaults;

  try {
    const parsedSettings = JSON.parse(savedSettings) as Partial<LlmSettings>;

    return {
      apiKey: parsedSettings.apiKey ?? defaults.apiKey,
      baseUrl: parsedSettings.baseUrl ?? defaults.baseUrl,
      model: parsedSettings.model ?? defaults.model,
    };
  } catch {
    return defaults;
  }
}

export function saveLlmSettings(settings: LlmSettings) {
  window.localStorage.setItem(llmSettingsStorageKey, JSON.stringify(settings));
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, "");
}

function assertConfigured(settings: LlmSettings) {
  if (!settings.apiKey.trim()) {
    throw new Error("还没有配置 LLM API key。请在右上角设置里填写 OpenAI-compatible API key。");
  }

  if (!settings.baseUrl.trim()) {
    throw new Error("还没有配置 LLM base URL。");
  }

  if (!settings.model.trim()) {
    throw new Error("还没有配置 LLM model。");
  }
}

function buildNodeContentPrompt(input: GenerateNodeContentInput) {
  return `请为 Tree Knowledge 的一个节点生成主要正文。

节点标题：${input.title}
节点目标：${input.goal}
父节点：${input.parentTitle ?? "无"}

允许继承的上下文摘要：
${
  input.contextSummaries?.length
    ? input.contextSummaries
        .map((item) => `- ${item.title}: ${item.summary}`)
        .join("\n")
    : "- 无"
}

输出要求：
- 只输出 Markdown 正文，不要输出 JSON。
- 第一行使用二级标题：## ${input.title}
- 内容应该像直接回答用户问题的主要答案，不要写成问答聊天。
- 不要自动引用兄弟分支、无关分支、归档节点或未确认网页来源。
- 如果需要公式、列表或表格，可以直接使用 Markdown 和 KaTeX 兼容语法。
- 保持主题独立，方便这张卡片以后作为一个独立上下文节点继续发展。`;
}

async function readErrorMessage(response: Response) {
  const text = await response.text();
  if (!text) return `${response.status} ${response.statusText}`;

  try {
    const data = JSON.parse(text) as { error?: { message?: string } };
    return data.error?.message ?? text;
  } catch {
    return text;
  }
}

async function* readChatCompletionStream(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("LLM 响应没有返回可读取的流。");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine.startsWith("data:")) continue;

      const payload = trimmedLine.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;

      const chunk = JSON.parse(payload) as ChatCompletionChunk;
      const content = chunk.choices?.[0]?.delta?.content;
      if (content) yield content;
    }
  }
}

export async function* generateNodeContentStream(
  input: GenerateNodeContentInput,
  settings: LlmSettings,
) {
  assertConfigured(settings);

  const response = await fetch(`${normalizeBaseUrl(settings.baseUrl)}/chat/completions`, {
    body: JSON.stringify({
      messages: [
        {
          content:
            "你是 Tree Knowledge 的节点内容生成器。你只根据根节点、父链和当前节点目标生成内容，严格避免引入兄弟分支或未确认来源。",
          role: "system",
        },
        {
          content: buildNodeContentPrompt(input),
          role: "user",
        },
      ],
      model: settings.model.trim(),
      stream: true,
      temperature: 0.35,
    }),
    headers: {
      Authorization: `Bearer ${settings.apiKey.trim()}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`LLM 请求失败：${await readErrorMessage(response)}`);
  }

  yield* readChatCompletionStream(response);
}
