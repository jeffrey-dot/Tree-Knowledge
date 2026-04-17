# API 契约

## 目标
MVP 的 API 以节点和工作台为中心，而不是以聊天会话为中心。  
后端应尽量返回可直接驱动界面的聚合数据，避免前端自行拼装复杂图谱关系。

## 通用约定
- 所有接口默认返回 JSON
- `id` 使用 UUID 字符串
- 时间字段使用 ISO 8601
- 节点状态枚举：`draft`、`confirmed`、`archived`
- 节点模式枚举：`child`、`branch`、`related`
- 关系类型枚举：`related_to`、`supports`、`contrasts`、`example_of`、`depends_on`

## `GET /workspaces`
获取用户的知识库（工作区）列表，供首页大屏使用。

### 响应体
```json
{
  "workspaces": [
    {
      "id": "uuid",
      "name": "string",
      "description": "string",
      "root_node_id": "uuid",
      "node_count": 0,
      "updated_at": "2026-04-17T10:00:00Z"
    }
  ]
}
```

## `POST /workspaces`
创建一个全新的知识库。

### 请求体
```json
{
  "name": "string",
  "description": "string",
  "initial_question": "string"
}
```

## `POST /nodes/root`
创建根节点。

### 请求体
```json
{
  "question": "什么是 Tree Knowledge"
}
```

### 响应体
```json
{
  "node": {
    "id": "uuid",
    "title": "Tree Knowledge",
    "summary": "string",
    "body": "string",
    "status": "confirmed"
  }
}
```

### 规则
- 创建后该节点立即成为当前节点
- 根节点不写入 `node_hierarchy`

### 失败场景
- `question` 为空
- LLM 返回结构不可解析

## `POST /nodes/{id}/generate-candidates`
基于当前节点生成候选扩展主题。

### 请求体
```json
{
  "query": "这个主题还能从哪些方向展开"
}
```

### 响应体
```json
{
  "base_node_id": "uuid",
  "candidates": [
    {
      "candidate_id": "uuid",
      "title": "string",
      "summary": "string",
      "mode": "child",
      "suggested_relation_type": "related_to",
      "why_this_branch": "string"
    }
  ]
}
```

### 规则
- 此接口只生成候选记录，不创建正式节点
- 候选数量上限为 5

### 失败场景
- 节点不存在
- 节点已归档
- LLM 输出为空或超过结构限制

## `POST /nodes/{id}/expand`
基于当前节点直接创建新节点，或采纳某个候选节点。

### 请求体
直接生成模式：
```json
{
  "mode": "child",
  "query": "继续解释它的底层机制"
}
```

采纳候选模式：
```json
{
  "mode": "branch",
  "candidate_id": "uuid"
}
```

### 响应体
```json
{
  "node": {
    "id": "uuid",
    "title": "string",
    "summary": "string",
    "body": "string",
    "status": "confirmed"
  },
  "placement": {
    "mode": "child",
    "parent_node_id": "uuid",
    "suggested_relation_type": "related_to"
  }
}
```

### 规则
- `mode` 必须明确
- 当 `mode=related` 时，仍创建正式节点，但层级父节点保持当前节点不变或为空，具体实现必须在应用层写死，不允许临时猜测
- 如果使用 `candidate_id`，该候选必须属于当前 `base_node_id`

### 失败场景
- `query` 与 `candidate_id` 同时缺失
- 指定候选不存在
- 节点落位校验失败

## `PATCH /nodes/{id}`
更新节点内容。

### 请求体
```json
{
  "title": "string",
  "summary": "string",
  "body": "string",
  "status": "confirmed"
}
```

### 响应体
```json
{
  "node": {
    "id": "uuid",
    "title": "string",
    "summary": "string",
    "body": "string",
    "status": "confirmed",
    "updated_at": "2026-04-17T10:00:00Z"
  }
}
```

### 规则
- 任一字段可部分更新
- 摘要或正文发生明显变化后，应触发上下文快照刷新

### 失败场景
- 节点不存在
- 状态非法

## `PATCH /nodes/{id}/move`
调整节点主父节点。

### 请求体
```json
{
  "new_parent_id": "uuid"
}
```

### 响应体
```json
{
  "node_id": "uuid",
  "old_parent_id": "uuid",
  "new_parent_id": "uuid"
}
```

### 规则
- 不允许形成环
- 节点移动后需要刷新祖先路径和上下文快照

### 失败场景
- `new_parent_id` 不存在
- 试图把节点移动到自己的后代下

## `POST /nodes/{id}/edges`
创建节点关系边。

### 请求体
```json
{
  "target_node_id": "uuid",
  "relation_type": "supports"
}
```

### 响应体
```json
{
  "edge": {
    "id": "uuid",
    "from_node_id": "uuid",
    "to_node_id": "uuid",
    "relation_type": "supports"
  }
}
```

### 规则
- 不允许创建自环
- 若边已存在，可返回现有边或报冲突，具体行为应在实现中固定，不允许接口含糊

### 失败场景
- 目标节点不存在
- 关系类型非法

## `GET /nodes/{id}/workspace-view`
获取工作台聚合视图数据。

### 响应体
```json
{
  "current_node": {
    "id": "uuid",
    "title": "string",
    "summary": "string",
    "body": "string",
    "status": "confirmed"
  },
  "ancestors": [
    {
      "id": "uuid",
      "title": "string",
      "summary": "string"
    }
  ],
  "children": [
    {
      "id": "uuid",
      "title": "string",
      "summary": "string"
    }
  ],
  "related_nodes": [
    {
      "id": "uuid",
      "title": "string",
      "summary": "string",
      "relation_type": "related_to"
    }
  ],
  "context_snapshot": {
    "context_summary": "string",
    "ancestor_summary": "string"
  },
  "recent_candidates": [
    {
      "candidate_id": "uuid",
      "title": "string",
      "summary": "string",
      "mode": "child"
    }
  ]
}
```

### 规则
- 返回内容必须足够让前端一次性渲染三栏工作台
- 归档节点默认不出现在 `children` 和 `related_nodes`

### 失败场景
- 节点不存在

## `GET /search/nodes`
搜索节点。

### 查询参数
- `workspace_id`：必须。限定在某个知识库内搜索。
- `q`：搜索词

### 响应体
```json
{
  "items": [
    {
      "id": "uuid",
      "title": "string",
      "summary": "string",
      "path": [
        {
          "id": "uuid",
          "title": "string"
        }
      ]
    }
  ]
}
```

### 规则
- 搜索结果对象必须是节点，不返回消息片段
- 每个结果必须带路径信息，便于定位

### 失败场景
- 查询词为空

## 错误响应格式
建议统一错误响应：

```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "query is required"
  }
}
```

推荐错误码：
- `INVALID_INPUT`
- `NOT_FOUND`
- `CONFLICT`
- `INVALID_GRAPH_OPERATION`
- `LLM_OUTPUT_INVALID`
