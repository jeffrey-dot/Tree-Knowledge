# 树形知识库 Tree Knowledge

树形知识库是一款桌面端 LLM 知识库与上下文管理系统。

核心想法很简单：**LLM 上下文应该是一棵树，而不是一条线性聊天记录**。每个节点都是独立语义上下文，只能继承根节点和父链上下文，因此临时问题和旁路探索不会污染主线。

## 产品方向

- 面向个人知识工作者的桌面应用。
- 本地优先的数据存储。
- 内置 OpenAI 兼容的主题总结与上下文辅助能力。
- 使用可视化树画布，而不是文件夹式导航。
- 支持从任意节点或消息显式创建分支。
- 节点摘要用于快速重建上下文。
- 支持检索当前节点、父链和全局知识，默认优先当前节点与父链。
- 可选的用户触发式网页搜索/抓取，不自动污染上下文。

## 仓库状态

仓库目前包含第一版 mock 桌面工作台：

- Vite + React + TypeScript 实现树形知识画布。
- Tauri 2 作为桌面端外壳。
- 当前只使用 mock 数据，用于验证交互和视觉方向。

后续实现目标仍然是：

- SQLite 作为本地持久化。
- 本地向量索引或 SQLite 向量扩展用于检索。
- OpenAI 兼容的 chat 和 embedding API。

## 运行 Web Mock

```bash
npm install
npm run dev
```

## 运行桌面端

```bash
npm install
npm run desktop:dev
```

## 构建桌面端

```bash
npm run desktop:build
```

当前 Linux 构建目标是 `.deb` 和 `.rpm`。

当前版本用于展示桌面端主工作流：全屏树画布、父链高亮、点击节点打开详情弹窗、悬浮节点展开可创建的子主题，以及手动输入问题生成新节点。

## 文档

- [AGENTS.md](./AGENTS.md)：给后续 coding agents 和维护者的规则。
- [Product Spec](./docs/product-spec.md)：产品目标、用户模型、MVP 范围和非目标。
- [Context Rules](./docs/context-rules.md)：严格上下文继承与检索行为。
- [Architecture](./docs/architecture.md)：数据模型、服务和运行流程规划。
- [MVP Roadmap](./docs/mvp-roadmap.md)：构建里程碑和验收标准。

## 核心不变量

对于任意当前节点，LLM 只能使用：

1. 根节点上下文，
2. 父链上下文，
3. 当前节点上下文，
4. 用户显式选择的搜索、网页或引用结果。

兄弟分支和无关节点绝不能自动进入上下文。
