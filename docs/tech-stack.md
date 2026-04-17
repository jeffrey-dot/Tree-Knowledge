# 技术栈定稿

## 目标
这份文档用于明确 Tree Knowledge 的 MVP 技术栈，确保桌面壳、数据层、图谱渲染、本地存储和 LLM Provider 集成都有统一决策，不在实现阶段反复摇摆。

选型原则：
- 优先本地优先和单机可运行
- 优先 TypeScript 全栈一致性
- 优先成熟稳定生态
- 图谱可视化轻量实现，不为 MVP 引入图数据库
- LLM 调用可替换，但 Provider 配置格式先统一为 OpenAI 兼容格式
- 不以 Web 部署和服务端托管为前提

## 总体结论
MVP 技术栈定为：

- 桌面壳：`Electron`
- 渲染层：`Vite` + `React 19` + `TypeScript`
- UI：`Tailwind CSS v4` + `Motion` + `Lucide React`
- 图谱渲染：`React Flow`
- 本地数据库：`SQLite`
- SQLite 驱动：`better-sqlite3`
- ORM：`Drizzle ORM`
- 校验：`Zod`
- 本地配置：`electron-store`
- 密钥存储：`keytar`
- LLM 接入：Provider Adapter Layer
- 打包：`electron-builder`
- 包管理：`pnpm`

## 1. 桌面壳与渲染层
### 桌面壳
选型：`Electron`

原因：
- 适合本地优先桌面应用
- 可以访问本地文件系统、系统目录和安全存储
- 适合后续做本地导入导出、Provider 配置和桌面分发
- 用户无需依赖独立浏览器运行

结论：
- 使用主进程 + preload + renderer 分层
- 默认开启 `contextIsolation`
- 渲染层不直接访问 Node 能力
- 所有敏感能力通过 preload 暴露白名单 bridge

### 渲染层
选型：
- `Vite`
- `React 19`
- `TypeScript`

原因：
- Electron + Vite 的开发体验成熟
- 启动快，适合高频 UI 迭代
- React 生态可继续复用现有工作台和图谱设计

结论：
- 渲染层采用标准 React 单页结构
- 桌面应用内主要视图包括：
  - 启动台
  - 知识工作台
  - Provider 管理
  - 应用设置

## 2. UI 与交互层
选型：
- `Tailwind CSS v4`
- `Motion`
- `Lucide React`

原因：
- 视觉规范已经明确，需要快速落样式令牌和组件层级
- Tailwind 适合把 `visual-spec.md` 中的 tokens 直接写进系统
- Motion 足够支撑启动台团块呼吸、卡片浮动、工作台切换动画
- Lucide 适合线性图标语言，和当前视觉方向一致

补充规则：
- 不引入完整重型组件库作为主 UI 框架
- 允许后续局部参考 `shadcn/ui` 的无头模式，但不把它当视觉系统

## 3. 图谱渲染
选型：`React Flow`

原因：
- 足够成熟，适合节点、边、缩放、拖拽、hover 和自定义节点
- 可以先做有限半径图谱，而不是上来做复杂图库
- React 生态集成成本低

实现策略：
- MVP 不做自由画布编辑器
- 只做“可浏览、可切换当前节点、可显示关系”的受控图谱
- 布局先由主进程或渲染层规则计算，不引入复杂图算法引擎

明确不选：
- `Cytoscape.js`
- `D3` 直写
- 图数据库专用渲染库

## 4. 应用服务层
### 调用方式
选型：Electron 主进程服务 + preload bridge

原因：
- 本地端不需要 HTTP 形式的应用接口作为主通信方式
- 数据读取、Provider 调用、导入导出和文件访问更适合走进程间调用
- 能把敏感能力收敛在主进程

结论：
- 业务命令与查询定义为应用服务方法
- UI 通过 typed bridge 调用主进程服务
- 不设计 Web Route 作为主入口

### 校验
选型：`Zod`

原因：
- 与 TypeScript、Drizzle 配合自然
- 可直接用于命令入参和 LLM 输出结构校验

## 5. 数据层
### 数据库
选型：`SQLite`

原因：
- 适合单用户、本地优先知识库
- 节点、层级、关系边、候选记录都适合标准 SQL 建模
- 无需先引入独立数据库服务
- 便于用户备份、迁移和导出

### 驱动
选型：`better-sqlite3`

原因：
- 在 Electron 主进程里简单直接
- 同步调用方式对本地单机应用足够稳定
- 与 Drizzle 配合成熟

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

## 6. LLM 集成
### Provider 适配层
选型：自定义 `OpenAI-Compatible Provider Adapter Layer`

原因：
- 用户希望接入自己的模型提供商
- 产品需要把“知识结构编排”和“模型供应商”解耦
- 当前阶段不希望为不同厂商维护多套请求格式
- 只要 Provider 提供 OpenAI 兼容接口，就能接入

MVP 支持范围：
- `OpenAI` 官方接口
- 任何 `OpenAI-compatible` 服务

MVP 任务分层：
- `generateRootNode`
- `generateCandidateNodes`
- `generateDirectNode`
- `generateContextSnapshot`

规则：
- 所有 LLM 返回都必须经过 `Zod` 校验
- prompt 与 schema 独立成服务层，不散落在 UI 组件里
- 不把任意厂商 SDK 耦合进上层业务逻辑
- 所有 Provider 请求统一走 OpenAI 兼容请求结构

### 凭证存储
选型：
- 基础配置：`electron-store`
- 密钥存储：`keytar`

规则：
- API Key 不明文写入 SQLite
- Provider 配置和默认模型映射可序列化保存
- 敏感凭证优先交给系统 keychain

### Provider 配置字段
MVP 固定 Provider 配置字段为：
- `name`
- `base_url`
- `api_key`
- `default_model`
- `enabled`

不支持：
- 厂商专有字段分支
- 多种鉴权模式
- 非 OpenAI 兼容的消息格式

## 7. 用户与账号
MVP 阶段默认单用户、本地单实例优先。

结论：
- 第一阶段不做账号体系
- 不做登录和云同步前置要求
- 先把知识库、节点、Provider 配置和生成链路打通

## 8. 搜索
MVP 选型：`SQLite LIKE / FTS`

原因：
- 当前搜索对象是知识库和节点，量级不大
- 不需要一开始接 Elasticsearch / Meilisearch

升级路径：
- MVP：标题 + 摘要 + 路径搜索
- 后续：SQLite FTS5

## 9. 异步任务
MVP 不单独引入消息队列。

处理方式：
- 先同步完成核心创建链路
- 对上下文快照重建等非关键任务，使用应用内异步触发或本地任务队列补偿

后续如有需要再引入：
- `PQueue`
- 或单独本地任务 worker

## 10. 打包与运行环境
### 推荐打包
- macOS / Windows / Linux：`electron-builder`

### 运行环境
- Node.js 开发环境建议 `20.9+`
- 桌面应用运行时由 Electron 自带 Node/Chromium

### 本地配置项
至少包括：
- 默认知识库存储目录
- Provider 列表
- 默认 Provider
- 默认模型映射：
  - candidate
  - direct
  - summary

## 11. 项目结构建议
建议采用以下结构：

```text
electron/
  main/
  preload/
src/
  views/
    launchpad/
    workspace/
    provider-settings/
    app-settings/
components/
  ui/
  workspace/
  launchpad/
lib/
  db/
  llm/
  graph/
  providers/
  validators/
drizzle/
docs/
```

说明：
- `electron/main`：应用生命周期、窗口管理、数据库和命令服务
- `electron/preload`：安全桥接层
- `src/views/launchpad`：桌面启动台
- `src/views/workspace`：知识工作台
- `src/views/provider-settings`：Provider 管理
- `src/views/app-settings`：应用设置
- `components/workspace`：图谱、左右栏、输入区
- `components/launchpad`：启动台 Hero、总览区、卡片流
- `lib/llm`：模型调用和 prompt/schema
- `lib/providers`：OpenAI-compatible Provider 适配层
- `lib/db`：Drizzle client 和 query helpers

## 12. 不采用的技术
MVP 明确不采用：
- 图数据库
- 微服务拆分
- Next.js
- React Native
- Prisma
- Elasticsearch
- 重型可视化引擎
- 传统聊天 UI SDK

## 13. 最终决策摘要
### 必选
- `Electron`
- `Vite`
- `React 19`
- `TypeScript`
- `Tailwind CSS v4`
- `Motion`
- `Lucide React`
- `React Flow`
- `SQLite`
- `better-sqlite3`
- `Drizzle ORM`
- `Zod`
- `electron-store`
- `keytar`
- `electron-builder`
- `pnpm`

### 可选后补
- `SQLite FTS5`
- `PQueue`
- 本地文件导入器
- 非 OpenAI 兼容 Provider 适配

## 14. 开发顺序建议
1. 初始化 `Electron + Vite + React + TypeScript + pnpm`
2. 接入 `Drizzle + SQLite`
3. 落 `workspaces / nodes / node_hierarchy / node_edges`
4. 搭桌面启动台、工作台和 Provider 设置静态骨架
5. 接 `React Flow`
6. 实现本地命令/查询服务和工作台聚合视图
7. 接 Provider 适配层和 LLM 服务层
8. 完成候选生成和直接生成链路
