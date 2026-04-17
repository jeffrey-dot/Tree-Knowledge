# 技术栈定稿

## 目标
这份文档用于明确 Tree Knowledge 的 MVP 技术栈，确保前后端、数据库、图谱渲染和 LLM 集成都有统一决策，不在实现阶段反复摇摆。

选型原则：
- 优先单仓快速起步
- 优先 TypeScript 全栈一致性
- 优先成熟稳定生态
- 图谱可视化轻量实现，不为 MVP 引入图数据库
- LLM 调用可替换，但默认先接 OpenAI 兼容接口

## 总体结论
MVP 技术栈定为：

- 前端：`Next.js 16.2` + `React 19` + `TypeScript`
- UI：`Tailwind CSS v4` + `Motion` + `Lucide`
- 图谱渲染：`React Flow`
- 后端：`Next.js Route Handlers`
- 数据库：`PostgreSQL`
- ORM：`Drizzle ORM`
- 校验：`Zod`
- LLM 接入：`OpenAI API`
- 缓存 / 队列：MVP 暂不引入 Redis，先用数据库 + 异步任务补偿
- 部署：`Vercel` + `Neon` 或 `Railway` + `Postgres`
- 包管理：`pnpm`

## 1. 前端栈
### 框架
选型：`Next.js 16.2`

原因：
- 适合同时承载首页、工作台和 API
- App Router 适合页面分层和服务端数据获取
- 后续接鉴权、流式返回、服务端调用模型都顺手
- 与 React 19 配合稳定，适合现代交互界面

结论：
- 使用 `App Router`
- 默认采用 `TypeScript`
- 页面按 `app/` 结构组织
- Node.js 运行时最低要求为 `20.9+`
- 默认采用 `Turbopack`
- 如需请求前置逻辑，优先按 Next.js 16 的 `proxy` 方向设计，不再围绕旧的 `middleware` 写新能力

### UI 层
选型：
- `Tailwind CSS v4`
- `Motion`
- `Lucide React`

原因：
- 视觉规范已经明确，需要快速落样式令牌和组件层级
- Tailwind 适合把 `visual-spec.md` 中的 tokens 直接写进系统
- Motion 足够支撑首页团块呼吸、卡片浮动、工作台切换动画
- Lucide 适合线性图标语言，和当前视觉方向一致

补充规则：
- 不引入完整重型组件库作为主 UI 框架
- 允许后续局部参考 `shadcn/ui` 的无头模式，但不把它当视觉系统

## 2. 图谱渲染
选型：`React Flow`

原因：
- 足够成熟，适合节点、边、缩放、拖拽、hover 和自定义节点
- 可以先做有限半径图谱，而不是上来做复杂图库
- React 生态集成成本低

实现策略：
- MVP 不做自由画布编辑器
- 只做“可浏览、可切换当前节点、可显示关系”的受控图谱
- 布局先由后端或前端规则计算，不引入复杂图算法引擎

明确不选：
- `Cytoscape.js`：功能强，但对 MVP 偏重
- `D3` 直写：灵活但开发维护成本高
- 图数据库专用前端：过早优化

## 3. 后端栈
### 运行时
选型：`Next.js Route Handlers`

原因：
- 当前项目规模适合单仓一体化
- 前后端统一在一个 TypeScript 项目里，减少样板和通信成本
- API 契约已经稳定，用 Route Handlers 就能直接落地

结论：
- API 放在 `app/api/`
- 先不拆独立服务
- 后续只有在异步任务、协作和负载明显上升时再拆后端服务

### 请求校验
选型：`Zod`

原因：
- 与 TypeScript、Drizzle 配合自然
- 可直接用于 API 入参和 LLM 输出结构校验

## 4. 数据层
### 数据库
选型：`PostgreSQL`

原因：
- 已在产品文档中确定关系型数据库优先
- 节点、层级、关系边、候选记录都适合标准 SQL 建模
- 后续可逐步补全文搜索、JSON 字段和物化视图

### ORM
选型：`Drizzle ORM`

原因：
- 类型安全强
- schema 清晰，适合以文档驱动建模
- 比 Prisma 更轻，生成链路更可控

### 迁移
选型：`drizzle-kit`

规则：
- 所有表结构以 `docs/data-model.md` 为真相源
- schema 变更必须同步文档

## 5. LLM 集成
### 默认模型接入
选型：`OpenAI API`

原因：
- 当前产品能力和文档都围绕结构化生成、候选生成、摘要压缩
- OpenAI 生态对 JSON schema、结构化输出和多模型切换更方便

MVP 接口分层：
- `generateRootNode`
- `generateCandidateNodes`
- `generateDirectNode`
- `generateContextSnapshot`

规则：
- 所有 LLM 返回都必须经过 `Zod` 校验
- prompt 与 schema 独立成服务层，不散落在路由里

### SDK
选型：`openai` 官方 Node SDK

## 6. 鉴权与用户
MVP 阶段默认单用户优先。

选型：
- 第一阶段可不做完整鉴权
- 如果需要登录，首选 `NextAuth/Auth.js`

结论：
- 不把鉴权作为第一阶段阻塞项
- 先把工作区、节点和生成链路打通

## 7. 搜索
MVP 选型：`Postgres ILIKE / 全文检索`

原因：
- 当前搜索对象是知识库和节点，量级不大
- 不需要一开始接 Elasticsearch / Meilisearch

升级路径：
- MVP：标题 + 摘要 + 路径搜索
- 后续：Postgres Full-Text Search

## 8. 异步任务
MVP 不单独引入消息队列。

处理方式：
- 先同步完成核心创建链路
- 对上下文快照重建等非关键任务，使用应用内异步触发或数据库状态补偿

后续如有需要再引入：
- `Upstash Redis`
- 或 `Trigger.dev`

## 9. 部署与环境
### 推荐部署
方案 A：
- 前端 / API：`Vercel`
- 数据库：`Neon Postgres`

方案 B：
- 一体部署：`Railway`

MVP 推荐：
- 如果追求极简上线，优先 `Vercel + Neon`

### 环境变量
至少包括：
- `DATABASE_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL_CANDIDATE`
- `OPENAI_MODEL_DIRECT`
- `OPENAI_MODEL_SUMMARY`

## 10. 项目结构建议
建议采用以下结构：

```text
app/
  (marketing)/
  workspace/
  api/
components/
  ui/
  workspace/
  library-home/
lib/
  db/
  llm/
  graph/
  validators/
drizzle/
docs/
```

说明：
- `app/(marketing)`：知识库首页或未来轻营销入口
- `app/workspace`：知识工作台
- `app/api`：所有 API
- `components/workspace`：图谱、左右栏、输入区
- `components/library-home`：首页 Hero、总览区、卡片流
- `lib/llm`：模型调用和 prompt/schema
- `lib/db`：Drizzle client 和 query helpers

## 11. 不采用的技术
MVP 明确不采用：
- 图数据库
- 微服务拆分
- Electron
- React Native
- Prisma
- Elasticsearch
- 重型可视化引擎
- 传统聊天 UI SDK

## 12. 最终决策摘要
### 必选
- `Next.js 16.2`
- `React 19`
- `TypeScript`
- `Tailwind CSS v4`
- `Motion`
- `Lucide React`
- `React Flow`
- `PostgreSQL`
- `Drizzle ORM`
- `Zod`
- `openai` SDK
- `pnpm`

### 可选后补
- `Auth.js`
- `Trigger.dev`
- `Postgres Full-Text Search`

## 13. 开发顺序建议
1. 初始化 `Next.js 16.2 + Tailwind + TypeScript + pnpm`
2. 接入 `Drizzle + Postgres`
3. 落 `workspaces / nodes / node_hierarchy / node_edges`
4. 搭首页和工作台静态骨架
5. 接 `React Flow`
6. 实现节点读取与工作台聚合视图
7. 接 LLM 服务层
8. 完成候选生成和直接生成链路
