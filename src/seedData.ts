import type { NodeDetail, RetrievalHit, TreeNode } from "./types";

export const nodes: TreeNode[] = [
  {
    id: "root",
    parentId: null,
    title: "树形知识库",
    goal: "定义一个本地优先的树形上下文系统，用于长期 LLM 工作。",
    summary:
      "产品把上下文视为一棵树。每个节点只继承根节点、父链和当前节点上下文。",
    status: "active",
    kind: "root",
    x: 80,
    y: 250,
    materials: 9,
    references: 4,
    webSources: 0,
    merged: 0,
  },
  {
    id: "product",
    parentId: "root",
    title: "产品形态",
    goal: "锁定 MVP 用户、平台和非目标。",
    summary:
      "第一版是面向个人知识工作者的桌面应用。云同步和团队协作不在 MVP 范围内。",
    status: "done",
    kind: "main",
    x: 350,
    y: 120,
    materials: 12,
    references: 2,
    webSources: 0,
    merged: 1,
  },
  {
    id: "context",
    parentId: "root",
    title: "上下文规则",
    goal: "保证严格的树形继承和可检查的 prompt 组装。",
    summary:
      "当前节点只能看到根节点、父链、当前摘要、本地素材和用户显式选择的来源。",
    status: "active",
    kind: "main",
    x: 360,
    y: 330,
    materials: 18,
    references: 6,
    webSources: 1,
    merged: 0,
  },
  {
    id: "ui",
    parentId: "context",
    title: "工作台界面",
    goal: "不用文件夹导航，也能让所有节点直观可见。",
    summary:
      "使用温暖的树画布、父链高亮、来源徽标和节点速览浮层。",
    status: "active",
    kind: "main",
    x: 650,
    y: 210,
    materials: 14,
    references: 3,
    webSources: 1,
    merged: 0,
  },
  {
    id: "temporary",
    parentId: "context",
    title: "临时问题",
    goal: "探索已归档节点是否应该出现在自动上下文中。",
    summary:
      "这是临时分支。除非用户合并结论，否则不应修改上下文规则主节点。",
    status: "active",
    kind: "temporary",
    x: 650,
    y: 420,
    materials: 5,
    references: 1,
    webSources: 0,
    merged: 0,
  },
  {
    id: "retrieval",
    parentId: "context",
    title: "检索排序",
    goal: "让当前节点和父链优先于全局知识。",
    summary:
      "排序顺序是当前节点、直接父节点、更早祖先、已确认引用、全局知识，最后是网页。",
    status: "done",
    kind: "research",
    x: 930,
    y: 330,
    materials: 8,
    references: 5,
    webSources: 0,
    merged: 1,
  },
  {
    id: "web",
    parentId: "ui",
    title: "网页来源暂存",
    goal: "抓取到的网页在用户确认前保持暂存状态。",
    summary:
      "网页结果显示 URL、抓取时间、摘要以及附加/丢弃操作。暂存结果会被排除。",
    status: "active",
    kind: "research",
    x: 940,
    y: 180,
    materials: 7,
    references: 1,
    webSources: 2,
    merged: 0,
  },
  {
    id: "archive",
    parentId: "product",
    title: "团队同步",
    goal: "以后再考虑协作能力。",
    summary:
      "MVP 阶段已归档。团队同步会引入账号、权限和冲突处理，因此暂缓。",
    status: "archived",
    kind: "decision",
    x: 650,
    y: 60,
    materials: 4,
    references: 0,
    webSources: 0,
    merged: 0,
  },
];

export const retrievalHits: RetrievalHit[] = [
  {
    id: "r1",
    title: "当前节点摘要",
    excerpt:
      "工作台界面应该以树画布为主，当前父链、节点速览和上下文预览都作为轻量浮层出现。",
    scope: "current",
    nodeId: "ui",
  },
  {
    id: "r2",
    title: "父链：上下文规则",
    excerpt:
      "自动上下文只包含根节点、父链摘要、当前摘要、最近当前素材和显式选择的内容。",
    scope: "parent",
    nodeId: "context",
  },
  {
    id: "r3",
    title: "全局：产品规格",
    excerpt:
      "第一版服务个人知识工作者，不做云同步、团队协作和自动跨分支混合。",
    scope: "global",
    nodeId: "product",
  },
  {
    id: "r4",
    title: "已排除兄弟分支：临时问题",
    excerpt:
      "这个兄弟分支在搜索中可见，但在被选择或合并前不会进入 prompt。",
    scope: "excluded",
    nodeId: "temporary",
  },
];

export const nodeDetails: Record<string, NodeDetail> = {
  root: {
    content:
      "## Tree Knowledge 要解决的问题\n\nTree Knowledge 解决的是长线 LLM 工作里的上下文失控问题。传统聊天是一条线，临时问题、主线任务、旁路探索都会混在一起；这个产品把内容拆成一棵树，让每个节点只承载一个独立语义主题。\n\n根节点保存共同背景，父链保存当前方向，当前节点保存正在处理的问题。用户可以从任意节点继续，也可以把临时问题生成新的子卡片，而不是继续写进原来的窗口。\n\n**MVP 第一优先级** 是证明树形上下文边界正确：当前节点只能继承根、父链和自己；兄弟分支默认排除；发送给 LLM 的上下文必须可检查。",
  },
  product: {
    content:
      "## 第一版产品形态\n\n第一版应该是个人桌面应用，本地优先，围绕一张可视化树画布展开。用户打开应用后直接进入工作树，而不是看到营销首页、文件夹导航或团队空间。\n\nMVP 不应该先做账号、云同步、权限或实时协作。这些能力会引入大量非核心复杂度，反而削弱对树形上下文正确性的验证。",
  },
  context: {
    content:
      "## 自动上下文边界\n\n自动上下文只允许三类内容：\n\n1. 根节点\n2. 从根到当前节点的父链\n3. 当前节点自身\n\n兄弟节点、叔伯节点、归档节点和无关分支都不能自动进入 prompt。\n\n全局搜索和网页结果可以显示给用户，但进入上下文前必须明确标注来源，并由用户显式选择。这样用户能理解模型为什么看到了某段内容，也能看见哪些分支被排除了。\n\n> 上下文预览不是调试工具，而是核心使用体验的一部分。",
  },
  ui: {
    content:
      "## 工作台界面原则\n\n主界面应该把树画布放在第一层。用户先看到所有节点、当前节点和父链，再通过点击打开节点内容。节点卡片负责展示标题和摘要预览，弹窗只负责显示这个主题的主要内容。\n\n### 临时问题\n\n临时问题应该从当前节点旁边快速创建为子节点。输入问题后，系统把它总结成主题卡片；打开卡片时看到的是该主题的正文，而不是在同一个窗口里继续追问。\n\n这种结构可以让主线保持干净：一个节点对应一个主题，分叉问题变成新卡片，后续如果有价值再通过显式引用或未来的合并流程带回主线。",
  },
  temporary: {
    content:
      "## 临时分支行为\n\n临时问题会变成当前节点下面的子分支。它可以使用根节点和父链摘要作为背景，但它自己的内容只保存在这个临时节点里。\n\n父节点不会反向读取临时分支。这个分支的结论如果有价值，未来应该通过显式引用或合并流程带回主线，而不是自动污染父节点。",
  },
  retrieval: {
    content:
      "## 检索排序\n\n默认排序应该优先当前节点，其次是直接父节点，再往上是更早的祖先节点。确认过的当前引用可以排在全局知识前面。\n\n行内公式示例：检索分数可以表示为 $score = 0.55s + 0.30c + 0.15f$，其中 $s$ 是语义相似度，$c$ 是父链权重，$f$ 是新鲜度。\n\n块级公式示例：\n\n$$\nscore(n, q) = 0.55 \\cdot sim(q, n) + 0.30 \\cdot chain(n) + 0.15 \\cdot fresh(n)\n$$\n\n| 来源 | 默认优先级 |\n| --- | --- |\n| 当前节点 | 最高 |\n| 父链 | 高 |\n| 全局知识 | 低，需要标注 |\n| 网页结果 | 低，需要确认 |\n\n全局结果和网页结果可以出现，但必须标注来源，并且不能自动进入 prompt。无关分支命中可以作为排除项显示，帮助用户理解边界。",
  },
  web: {
    content:
      "## 网页来源暂存\n\n网页结果首先是外部暂存来源，应该显示标题、URL、抓取时间和摘要。只有用户确认后，它才会成为当前节点的 durable context，并参与后续摘要或检索。\n\n未确认的网页内容要明确显示为排除状态，不能写入节点摘要、embedding 或 prompt。",
  },
  archive: {
    content:
      "## 团队同步暂缓\n\n团队同步会立即引入账号、权限、云端存储、冲突合并和审计问题，这些都不是 MVP 要证明的核心。当前版本应该先把个人本地树形上下文跑通。\n\n这个主题可以归档保留，但不应该出现在主工作流里，也不应该进入其他分支的自动上下文。",
  },
};
