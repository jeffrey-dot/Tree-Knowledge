# 数据模型

## 设计目标
MVP 采用关系型数据库，重点是结构稳定、可验证、易于迭代。  
树结构与横向关系分开存储，避免把主路径定位和图谱联想混成一种关系。

## 建模原则
- 节点是知识资产主表
- 层级关系单独存储，并且每个节点只有一个主父节点
- 横向关系边单独存储，用于图谱和语义联想
- LLM 生成过程中的候选主题和上下文快照单独存储，不污染主节点表

## 表设计
### `nodes`
保存正式知识节点。

字段建议：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | uuid | 主键 |
| `workspace_id` | uuid | 工作区标识，MVP 可先固定为单一工作区 |
| `title` | text | 节点标题 |
| `summary` | text | 节点摘要，供列表、图谱和上下文使用 |
| `body` | text | 节点正文 |
| `status` | text | `draft`、`confirmed`、`archived` |
| `created_by_type` | text | `user`、`ai`、`mixed` |
| `source_prompt` | text | 触发该节点生成的用户输入 |
| `source_answer` | text | 节点生成时的模型原始输出摘要或内容 |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

约束：
- `title` 不允许为空
- `summary` 可为空，但创建节点时推荐同步生成
- `status` 必须在枚举值内

### `node_hierarchy`
保存主父子关系。

字段建议：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | uuid | 主键 |
| `workspace_id` | uuid | 冗余工作区标识，用于硬隔离查询 |
| `parent_node_id` | uuid | 父节点 |
| `child_node_id` | uuid | 子节点 |
| `position` | double precision | 同级排序（推荐使用浮点数或 LexoRank 字符串以避免重排引发的批量更新） |
| `created_at` | timestamptz | 创建时间 |

约束：
- `child_node_id` 唯一，确保每个节点只有一个主父节点
- `parent_node_id` 与 `child_node_id` 不能相同
- 应通过应用层或数据库约束防止形成环

### `node_edges`
保存节点之间的横向关系。

字段建议：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | uuid | 主键 |
| `workspace_id` | uuid | 冗余工作区标识 |
| `from_node_id` | uuid | 起点节点 |
| `to_node_id` | uuid | 终点节点 |
| `relation_type` | text | 关系类型 |
| `weight` | numeric | 可选，表示关联强度 |
| `created_by_type` | text | `user`、`ai`、`mixed` |
| `created_at` | timestamptz | 创建时间 |

MVP 固定关系类型：
- `related_to`
- `supports`
- `contrasts`
- `example_of`
- `depends_on`

约束：
- 不允许自环
- 必须建立联合唯一索引 `UNIQUE(from_node_id, to_node_id, relation_type)`，避免重复边

### `node_context_snapshots`
保存供 LLM 调用的稳定上下文摘要。

字段建议：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | uuid | 主键 |
| `node_id` | uuid | 对应节点 |
| `context_summary` | text | 当前节点压缩摘要 |
| `ancestor_summary` | text | 祖先链压缩摘要 |
| `generated_at` | timestamptz | 快照生成时间 |

用途：
- 避免每次调用都重新压缩全部正文
- 在节点正文较长时仍能稳定提供短上下文

### `node_generation_candidates`
保存候选节点建议。

字段建议：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | uuid | 主键 |
| `base_node_id` | uuid | 候选基于哪个当前节点生成 |
| `user_query` | text | 用户此次输入 |
| `candidate_title` | text | 候选标题 |
| `candidate_summary` | text | 候选摘要 |
| `candidate_relation_type` | text | 推荐关系类型 |
| `candidate_mode` | text | `child`、`branch`、`related` |
| `accepted` | boolean | 是否被用户采纳 |
| `created_at` | timestamptz | 创建时间 |

用途：
- 让候选主题与正式节点分离
- 支持“先建议，再确认落库”的工作流

## 数据一致性规则
### 节点与层级
- 根节点不在 `node_hierarchy` 中拥有父节点
- 非根节点必须有一条有效的 `node_hierarchy` 记录
- 移动父节点时需要同步更新祖先路径和上下文快照

### 节点与关系边
- 关系边不影响主路径定位
- 归档节点默认不出现在工作台主视图，但其关系边可保留用于历史追溯

### 候选与正式节点
- 候选节点未被采纳前不写入 `nodes`
- 候选被采纳后，系统创建正式节点并保留候选记录

## 工作台读取模型
主进程服务应提供聚合读取，而不是让渲染层自己拼装复杂结构。  
`workspace-snapshot` 聚合结果至少应包含：
- 当前节点
- 祖先链
- 直接子节点
- 相关节点
- 当前节点的上下文快照
- 最近一次候选生成结果

## 推荐索引
- `nodes(workspace_id, updated_at)`
- `node_hierarchy(parent_node_id, position)`
- `node_hierarchy(child_node_id)`
- `node_edges(from_node_id, relation_type)`
- `node_edges(to_node_id, relation_type)`
- `node_generation_candidates(base_node_id, created_at)`

## MVP 不做的建模
- 自定义关系 schema
- 多工作区共享节点
- 复杂版本历史表
- 权限表
- 图数据库专用邻接优化
