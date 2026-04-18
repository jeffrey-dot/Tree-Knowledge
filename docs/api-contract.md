# 应用契约

## 目标
MVP 的应用契约以节点和工作台为中心，而不是以聊天会话为中心。  
桌面端应通过 Tauri command 与查询服务返回可直接驱动界面的聚合数据，避免前端自行拼装复杂图谱关系。

## 通用约定
- 所有命令和查询返回结构化对象
- `id` 使用 UUID 字符串
- 时间字段使用 ISO 8601
- 节点状态枚举：`draft`、`confirmed`、`archived`
- 节点模式枚举：`child`、`branch`、`related`
- 关系类型枚举：`related_to`、`supports`、`contrasts`、`example_of`、`depends_on`
- 调用方式默认通过 `frontend invoke -> Tauri command service`

## `listWorkspaces()`
获取本地知识库（工作区）列表，供桌面启动台使用。

### 返回结构
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

## `createWorkspace(input)`
创建一个全新的知识库。

### 输入结构
```json
{
  "name": "string",
  "description": "string",
  "initial_question": "string"
}
```

### 规则
- 创建成功后通常会立即调用 `createRootNode`
- 创建完成后应跳入该知识库的工作台

## `createRootNode(input)`
创建根节点。

### 输入结构
```json
{
  "workspace_id": "uuid",
  "question": "什么是 Tree Knowledge"
}
```

### 返回结构
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

## `generateCandidates(nodeId, input)`
基于当前节点生成候选扩展主题。

### 输入结构
```json
{
  "query": "这个主题还能从哪些方向展开"
}
```

### 返回结构
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
- 此命令只生成候选记录，不创建正式节点
- 候选数量上限为 5

## `expandNode(nodeId, input)`
基于当前节点直接创建新节点，或采纳某个候选节点。

### 输入结构
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

### 返回结构
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
- 当 `mode=related` 时，仍创建正式节点，但层级父节点保持当前节点不变或为空，具体实现必须在应用层写死
- 如果使用 `candidate_id`，该候选必须属于当前 `base_node_id`

## `updateNode(nodeId, input)`
更新节点内容。

### 输入结构
```json
{
  "title": "string",
  "summary": "string",
  "body": "string",
  "status": "confirmed"
}
```

### 返回结构
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

## `moveNode(nodeId, input)`
调整节点主父节点。

### 输入结构
```json
{
  "new_parent_id": "uuid"
}
```

### 返回结构
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

## `createEdge(nodeId, input)`
创建节点关系边。

### 输入结构
```json
{
  "target_node_id": "uuid",
  "relation_type": "supports"
}
```

### 返回结构
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
- 若边已存在，可返回现有边或报冲突，但行为必须固定

## `getWorkspaceSnapshot(nodeId)`
获取工作台聚合视图数据。

### 返回结构
```json
{
  "workspace": {
    "id": "uuid",
    "name": "string",
    "description": "string",
    "root_node_id": "uuid",
    "node_count": 0,
    "updated_at": "2026-04-17T10:00:00Z"
  },
  "current_node": {
    "id": "uuid",
    "title": "string",
    "summary": "string",
    "body": "string",
    "status": "confirmed"
  },
  "ancestors": [],
  "children": [],
  "related_nodes": [],
  "recent_nodes": [],
  "context_snapshot": {
    "context_summary": "string",
    "ancestor_summary": "string"
  },
  "recent_candidates": []
}
```

### 规则
- 返回内容必须足够让渲染层一次性渲染三栏工作台
- 归档节点默认不出现在 `children` 和 `related_nodes`

## `testProviderConnection(providerId)`
测试某个 Provider 的连通性。

### 返回结构
```json
{
  "ok": true,
  "checked_at": "2026-04-17T10:00:00Z",
  "message": "provider reachable"
}
```

## `searchNodes(input)`
搜索节点。

### 输入结构
```json
{
  "workspace_id": "uuid",
  "q": "string"
}
```

### 返回结构
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

## Provider 相关契约
### `listProviders()`
返回用户本地已配置的 Provider 列表。

### `saveProvider(input)`
保存一个 Provider 配置。

### Provider 配置格式
MVP 只支持 `OpenAI 格式兼容配置`。

输入结构：
```json
{
  "name": "string",
  "base_url": "string",
  "api_key": "string",
  "default_model": "string",
  "enabled": true
}
```

规则：
- `base_url` 必须指向 OpenAI-compatible 接口根地址
- `api_key` 为单一密钥字段
- `default_model` 为默认模型名
- `enabled` 为启用状态
- 不支持厂商专有字段分支
- 不支持非 OpenAI 兼容的请求协议

### `testProviderConnection(providerId)`
测试某个 Provider 的连通性与模型可用性。

### `setDefaultModels(input)`
设置默认模型映射：
- `candidate`
- `direct`
- `summary`

## 错误结构
建议统一错误结构：

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
- `PROVIDER_NOT_CONFIGURED`
- `PROVIDER_CONNECTION_FAILED`
