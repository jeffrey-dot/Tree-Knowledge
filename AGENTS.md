# AGENTS.md

## 项目定义
Tree Knowledge 是一个节点驱动的知识探索系统。项目目标是把用户与 LLM 的线性问答过程，沉淀为可回跳、可分叉、可关联的知识网络。

这个仓库中的主真相源不是聊天记录，而是 `docs/` 下的设计文档。

## 文档入口
主导航文档：
- [docs/README.md](./docs/README.md)

推荐阅读顺序：
1. [docs/vision.md](./docs/vision.md)
2. [docs/page-architecture.md](./docs/page-architecture.md)
3. [docs/page-spec.md](./docs/page-spec.md)
4. [docs/wireframes.md](./docs/wireframes.md)
5. [docs/visual-spec.md](./docs/visual-spec.md)
6. [docs/tech-stack.md](./docs/tech-stack.md)
7. [docs/mvp-workspace.md](./docs/mvp-workspace.md)
8. [docs/data-model.md](./docs/data-model.md)
9. [docs/llm-context.md](./docs/llm-context.md)
10. [docs/api-contract.md](./docs/api-contract.md)
11. [docs/roadmap.md](./docs/roadmap.md)

## 文档职责
- `docs/vision.md`：产品问题定义、目标、核心概念、设计原则
- `docs/page-architecture.md`：页面地图、页面目标、页面跳转关系和优先级
- `docs/page-spec.md`：页面模块、布局、状态和线框级交互细节
- `docs/wireframes.md`：低保真线框、图标语义、少字界面规则和首次引导方式
- `docs/visual-spec.md`：高保真视觉方向、色板、字体、组件样式、动效和 design tokens
- `docs/tech-stack.md`：前后端、数据库、图谱渲染、LLM 和部署选型
- `docs/mvp-workspace.md`：MVP 页面结构和主要交互
- `docs/data-model.md`：数据库模型、约束和读取形态
- `docs/llm-context.md`：LLM 行为边界、上下文拼装和输出协议
- `docs/api-contract.md`：后端接口和返回结构
- `docs/roadmap.md`：实现阶段与完成标准

## 协作规则
- 产品定义以 `docs/vision.md` 为准
- 页面地图和页面角色以 `docs/page-architecture.md` 为准
- 页面模块和页面状态以 `docs/page-spec.md` 为准
- 线框布局和图标引导以 `docs/wireframes.md` 为准
- 高保真视觉和样式变量以 `docs/visual-spec.md` 为准
- 技术实现栈以 `docs/tech-stack.md` 为准
- 页面行为以 `docs/mvp-workspace.md` 为准
- 数据结构以 `docs/data-model.md` 为准
- LLM 行为以 `docs/llm-context.md` 为准
- 接口契约以 `docs/api-contract.md` 为准

如果实现与文档冲突，优先更新文档或明确记录偏差，不要只在聊天中口头约定。

## 术语一致性
必须统一使用以下术语：
- 节点
- 知识库首页
- 当前节点
- 主父节点
- 关系边
- 候选节点
- 工作台

避免混用以下表达：
- 不要把节点称为“消息”
- 不要把知识库首页称为“普通列表页”
- 不要把工作台称为“会话页”
- 不要把候选节点称为“临时消息”

## 变更要求
新增功能时，至少检查是否需要同步更新以下文档：
- 页面地图变更：`docs/page-architecture.md`
- 页面模块变更：`docs/page-spec.md`
- 线框或图标语义变更：`docs/wireframes.md`
- 视觉规范变更：`docs/visual-spec.md`
- 技术选型变更：`docs/tech-stack.md`
- 交互变更：`docs/mvp-workspace.md`
- 数据结构变更：`docs/data-model.md`
- LLM 逻辑变更：`docs/llm-context.md`
- 接口变更：`docs/api-contract.md`
- 版本规划变更：`docs/roadmap.md`

## 实现原则
- 节点是主资产，消息只是生成材料
- 树负责定位，关系边负责联想
- 用户对结构拥有最终决定权
- 上下文围绕当前节点组装，不依赖整段历史聊天
- MVP 先用关系型数据库，不预设图数据库
