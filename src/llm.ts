export const defaultLlmMode = "stream";

export type GenerateNodeContentInput = {
  title: string;
  goal: string;
  parentTitle: string;
};

function createGeneratedNodeMarkdown(input: GenerateNodeContentInput) {
  return `## ${input.title}

这个主题由「${input.goal}」生成，已经从「${input.parentTitle}」拆成独立子节点。

### 生成结果

这张卡片会承载该问题的主要内容，而不是让用户在原节点里继续追问。当前节点仍然继承根节点和父链背景，但新生成的正文只属于这个分支。

- **主题边界**：围绕「${input.title}」沉淀一段可复用结论。
- **上下文来源**：只默认继承根节点、父链和当前父节点摘要。
- **隔离规则**：父节点和兄弟节点不会自动读取这张卡片的内容。

> 默认生成路径使用流式接口：内容会逐块进入卡片，并实时以 Markdown 渲染。
`;
}

export async function* generateNodeContentStream(input: GenerateNodeContentInput) {
  const markdown = createGeneratedNodeMarkdown(input);
  const chunks = markdown.match(/[\s\S]{1,9}/g) ?? [];

  for (const chunk of chunks) {
    await new Promise((resolve) => window.setTimeout(resolve, 24));
    yield chunk;
  }
}
