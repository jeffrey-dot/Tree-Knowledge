# PLAN.md

## 目标
把 Tree Knowledge 从文档阶段推进到可运行的本地桌面 MVP。

当前方向已经确定：
- 本地优先
- 桌面应用优先
- 用户自带 LLM Provider
- 节点驱动的知识工作台
- Provider 配置仅支持 OpenAI 格式兼容接口

## 当前基线
已完成：
- 产品与信息结构文档
- 视图地图与线框
- 高保真视觉规范
- 技术栈定稿
- 应用契约
- 测试规范

当前主技术栈：
- `Electron`
- `Vite`
- `React 19`
- `TypeScript`
- `SQLite`
- `Drizzle ORM`
- `React Flow`

## 开发策略
当前开发顺序明确采用 `Horizontal Layers`，不采用 `Vertical Slices`。

含义：
- 先搭底层共用能力，再长上层功能
- 先稳定 `main / preload / renderer`、数据库、命令/查询桥接、Provider 配置
- 再实现启动台、工作台、图谱和 LLM 主链路

原因：
- 这是桌面应用，不是纯页面项目
- `Electron` 分层、`SQLite` 数据层、Provider 配置和本地凭证都属于全局基础设施
- 如果先按功能切片开发，后续很容易反复重构 bridge、数据访问层和 Provider 配置逻辑

## 实施顺序
### Phase 1：项目骨架
目标：
- 建立可运行的桌面应用骨架

任务：
- 初始化 `Electron + Vite + React + TypeScript + pnpm`
- 建立 `main / preload / renderer` 分层
- 接入 `Tailwind CSS v4`
- 接入 `Lucide React`
- 接入 `Motion`
- 建立基础目录结构

完成标准：
- 应用可本地启动
- 渲染层可正常显示基础视图
- preload bridge 可调用一个最小示例命令

### Phase 2：数据层
目标：
- 建立本地数据库和核心数据模型

任务：
- 接入 `better-sqlite3`
- 接入 `Drizzle ORM`
- 落地 `workspaces / nodes / node_hierarchy / node_edges / node_context_snapshots / node_generation_candidates`
- 建立迁移流程
- 建立测试数据库方案

完成标准：
- 可创建数据库
- 可运行迁移
- 可通过主进程读写核心表

### Phase 3：Provider 配置
目标：
- 让用户可配置并测试自己的 LLM Provider

任务：
- 建立 Provider Adapter Layer
- 仅支持 `OpenAI 格式兼容接口`
- 接入 `electron-store`
- 接入 `keytar`
- 完成 Provider 管理视图
- 完成连通性测试命令

完成标准：
- 用户可新增 Provider
- 用户可测试连接
- 用户可设置默认模型映射
- Provider 配置字段固定为 OpenAI 兼容格式

### Phase 4：启动台
目标：
- 实现桌面启动台最小闭环

任务：
- 启动台 Hero
- 知识库卡片流
- 知识宇宙总览区静态版本
- 创建知识库流程
- 进入工作台流程

完成标准：
- 用户可创建知识库并进入工作台
- 启动台可展示本地知识库列表

### Phase 5：工作台
目标：
- 实现节点浏览与图谱主界面

任务：
- 左栏祖先路径 / 子节点 / 最近访问
- 中栏 `React Flow` 图谱
- 右栏节点详情
- 底部输入区
- `workspace-snapshot` 聚合读取

完成标准：
- 用户可浏览节点结构
- 用户可切换当前节点
- 工作台视图可稳定刷新

### Phase 6：LLM 主链路
目标：
- 打通候选生成和直接生成

任务：
- `generateRootNode`
- `generateCandidateNodes`
- `generateDirectNode`
- `generateContextSnapshot`
- Zod 输出校验
- Provider 路由逻辑

完成标准：
- 用户可生成根节点
- 用户可生成候选节点
- 用户可直接扩展节点

### Phase 7：结构编辑与搜索
目标：
- 让知识库可维护

任务：
- 移动节点父级
- 创建关系边
- 节点编辑
- 节点归档
- 搜索节点

完成标准：
- 用户可维护节点结构
- 搜索可定位到正确节点

### Phase 8：测试与稳定化
目标：
- 让 MVP 进入可持续迭代状态

任务：
- 单元测试
- 集成测试
- 组件测试
- 端到端主链路测试
- 补齐回归测试

完成标准：
- 核心命令有自动化测试覆盖
- Provider 配置和节点主链路可稳定回归

## 当前建议优先级
最先做：
1. Phase 1：项目骨架
2. Phase 2：数据层
3. Phase 3：Provider 配置

原因：
- 桌面应用骨架不定，其他工作没有落点
- 数据层不定，工作台和图谱无法落地
- Provider 不定，LLM 主链路无法验证
- Horizontal Layers 能减少后续重构成本

## 执行要求
- 每完成一个 Phase，都要同步更新文档
- 每进入实现阶段，都要对照 `docs/testing.md`
- 核心逻辑改动必须补测试或说明未补原因
