# LLM 上下文策略

## 目标
LLM 在 Tree Knowledge 中的作用不是维持一段无限增长的聊天，而是帮助用户围绕当前节点生成稳定、可归档、可落位的知识单元。

本策略要解决三个问题：
- 控制上下文长度，避免依赖整段聊天历史
- 让模型输出能落入已有图谱结构
- 把模型的“建议能力”和用户的“结构决定权”明确分开

## LLM 角色边界
LLM 负责：
- 为根问题生成根节点
- 为当前节点生成候选扩展主题
- 直接生成单个新节点草稿
- 建议节点落位方式和关系类型
- 为节点生成和更新上下文快照

LLM 不负责：
- 自动无限扩展图谱
- 决定最终主父节点
- 决定某条关系边是否永久成立
- 以整段聊天记录作为默认知识来源

## 两种调用模式
### `candidate mode`
适用于探索式请求。  
输出 3 到 5 个候选节点主题，供用户选择。

适用提问示例：
- 还能从哪些方向展开
- 下一步值得研究什么
- 这个主题有哪些关键分支

输出字段：
- `title`
- `summary`
- `mode`
- `suggested_relation_type`
- `why_this_branch`

### `direct mode`
适用于用户目标明确的请求。  
直接返回一个新节点草稿。

适用提问示例：
- 继续解释底层机制
- 给我一个反例
- 把这个主题拆成三个步骤中的第一步

输出字段：
- `title`
- `summary`
- `body`
- `mode`
- `suggested_relation_type`
- `reasoning`（优先输出思考过程以提高生成质量）

## 上下文来源
每次调用 LLM 时，默认只使用以下信息：
- 当前节点标题
- 当前节点摘要
- 当前节点正文压缩版
- 祖先链摘要
- 用户最新提问

按需附加：
- 当前节点最相关的 3 到 5 个节点摘要
- 用户手动选择的参考节点

明确不传：
- 完整历史聊天记录
- 无关兄弟节点全文
- 当前节点整棵子树

## 上下文组装顺序
建议按以下顺序构造 prompt：

1. 系统规则
2. 当前节点信息
3. 祖先链摘要
4. 相关节点摘要
5. 用户最新提问

其中：
- 系统规则说明当前任务是“生成或建议知识节点”，不是闲聊
- 当前节点是最高优先级上下文
- 祖先链只保留最近 3 到 5 层的压缩信息
- 相关节点只提供标题和摘要，不提供长正文

## Token 裁剪优先级
当上下文接近上限时，按以下顺序裁剪：

1. 先裁掉相关节点摘要
2. 再压缩祖先链摘要
3. 保留当前节点标题和摘要
4. 保留用户最新提问

不可裁掉的最小上下文：
- 当前节点标题
- 当前节点摘要
- 用户最新提问

## 上下文快照策略
为了避免每次都对长正文即时总结，系统应维护节点快照。

### 快照内容
- `context_summary`：当前节点可供模型理解的精简说明
- `ancestor_summary`：该节点在主路径中的背景压缩说明

### 快照更新时机
- 节点首次创建后
- 节点摘要或正文被显著编辑后
- 节点移动父级后
- 节点被大量追加子节点且需要重新压缩时

### 快照使用规则
- 优先使用最新快照作为 LLM 输入
- 当快照不存在或过旧时，允许即时生成后再调用主任务

## 默认落位规则
当用户未显式指定创建模式时，系统按以下规则判断：

- 用户在追问当前主题细节时，默认 `child`
- 用户切换到并列主题时，默认 `branch`
- 用户明显在建立跨主题联系时，默认 `related`
- 无法判断时，默认 `child`

这里的 `branch` 表示创建与当前节点同属某一上级主题的新分支；若当前节点本身为根节点，则 `branch` 可退化为根节点下的新子节点。

## 推荐 Prompt Schema
### 输入 Schema
```json
{
  "task_mode": "candidate | direct",
  "current_node": {
    "title": "string",
    "summary": "string",
    "body_compact": "string"
  },
  "ancestor_context": [
    {
      "title": "string",
      "summary": "string"
    }
  ],
  "related_context": [
    {
      "title": "string",
      "summary": "string",
      "relation_type": "string"
    }
  ],
  "user_query": "string"
}
```

### 输出 Schema
`candidate mode`

```json
{
  "candidates": [
    {
      "title": "string",
      "summary": "string",
      "mode": "child | branch | related",
      "suggested_relation_type": "related_to | supports | contrasts | example_of | depends_on",
      "why_this_branch": "string"
    }
  ]
}
```

`direct mode`

```json
{
  "node": {
    "reasoning": "string (先输出生成此节点的逻辑依据)",
    "title": "string",
    "summary": "string",
    "body": "string",
    "mode": "child | branch | related",
    "suggested_relation_type": "related_to | supports | contrasts | example_of | depends_on"
  }
}
```

## 失败场景与兜底
### 错误归类
如果模型错误判断了节点落位：
- 前端必须允许用户在确认前改成 `child`、`branch` 或 `related`
- 创建后也必须允许移动父节点或修改关系边

### 候选噪声过多
如果模型输出的候选质量差：
- 限制候选数量为 3 到 5 个
- 允许用户重新生成候选
- 后续可加入去重和质量评分，但不属于 MVP

### 上下文污染
如果模型持续引用无关内容：
- 检查是否错误传入了历史聊天
- 检查祖先链是否过深
- 检查相关节点数量是否过多

## 验收要求
- 同一节点连续追问多轮后，模型仍围绕当前节点生成
- 回跳到祖先节点后，模型不会被下游分支污染
- 候选生成与直接生成在输出结构上可稳定解析
- 节点移动父级后，后续生成能反映新的祖先背景
