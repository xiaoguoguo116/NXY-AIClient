# 追问与诊断接口

基础地址：`http://localhost`（内网部署后替换为服务器地址）。
认证沿用 RAGFlow：`Authorization: Bearer <API_KEY>`；必须使用有权访问对应助手的账号/API Key。

## 提问并一次性取得答案、块和耗时

`POST /api/v1/chat/completions`

```json
{
  "chat_id": "你的助手ID",
  "messages": [{"role": "user", "content": "你的测试集问题"}],
  "stream": false,
  "clarification_mode": true,
  "return_diagnostics": true
}
```

已有会话时增加 `session_id`；不传时由 RAGFlow 创建会话。后续点击选项必须使用首次返回的会话 ID。
`clarification_mode: true` 使用这次改造的知识库检索/澄清流程。它控制 RAGFlow 的检索编排，不保证模型供应商支持关闭模型思考。
`return_diagnostics` 默认关闭，开启后在 `data.diagnostics` 中返回完整诊断信息。

正常回答响应结构如下（字段值仅作示例，不是性能实测）：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "answer": "回答正文",
    "session_id": "会话ID",
    "chat_id": "助手ID",
    "reference": {"chunks": [], "doc_aggs": []},
    "optimization": {"record_id": "记录ID", "cache_status": "not_requested"},
    "diagnostics": {
      "record_id": "记录ID",
      "question": "用户原问题",
      "queries": ["原问题", "实际改写问题（如果有）"],
      "answer": "完整回答",
      "status": "answered",
      "cache_status": "not_requested",
      "timings_ms": {
        "query_preparation_ms": 100,
        "retrieval_ms": 200,
        "clarification_ms": 300,
        "answer_generation_ms": 1000,
        "first_output_ms": 1700,
        "total_ms": 1700
      },
      "retrieved_chunks": [{
        "chunk_id": "块ID", "doc_id": "文档ID", "kb_id": "知识库ID",
        "docnm_kwd": "文档名称", "content_with_weight": "块全文",
        "similarity": 0.4, "vector_similarity": 0.5, "term_similarity": 0.3
      }],
      "context_chunks": [],
      "clarification": null
    }
  }
}
```

- `retrieved_chunks`：本次检索返回给聊天流程的候选块（去重），不含向量数组；不是搜索引擎内部全部命中文档。
- `context_chunks`：送入上下文组装的块；最终实际使用的文本还受模型上下文长度限制，可通过记录详情中的 `prompt` 核对。
- `similarity` 为对应检索路径的原始分数，多路 RRF 排序不代表统一置信概率。
- 时间单位都是毫秒。`total_ms` 是服务端聊天流程耗时，不包含客户端网络往返和用户选择耗时。
- `first_output_ms` 是服务端首次文本输出；非流式请求在整段答案完成后才有输出。
- `query_preparation_ms` 包含改写、扩展和缓存校验；`answer_generation_ms` 包含生成及引用后处理。未执行的阶段可能没有对应字段。
- clarification-4 增加 `diagnostics.preprocessing`：包含 `original_question`、`normalized_question`、`retrieval_queries`、`ambiguity_signals`、`status` 和 `model_called`。`status` 为 `fast_path` 时跳过新增预处理模型调用；`fallback` 表示异常后使用原问题。
- `timings_ms.preprocessing_ms` 已包含在 `query_preparation_ms` 内，不应重复相加。管理员配置新增 `preprocessing_enabled` 和 `preprocessing_timeout_seconds`（默认 true、15 秒，避免首次请求超时跳过主题展开）。
- 预处理诊断新增 `intent_parts`，保留识别出的独立主题；检索最多四路，优先原问题和各主题检索词。多主题追问必须通过证据校验且覆盖所有识别出的主题，否则不发布片面的选项。
- clarification-5：非空且不超过 2000 字符的问题均检查错字，选项点击除外。`preprocessing` 新增 `confidence`、`corrections`、`context_used`、`missing_topic`；成功后不重复做多轮改写。模型低置信度改写不采纳，原问题始终保留。
- 无法确定查询事项时，返回 `clarification: {"needs_input": true, "options": []}`，`answer` 为补充提示，无 `cache_id`。前端显示提示并允许用户自由输入，不能对此响应发送 `clarification_selection`。后续携带同一 `session_id` 继续提问。

## 返回追问选项及点击

需要澄清时，`data.answer` 是提示语，并出现：

```json
{
  "clarification": {
    "cache_id": "服务端缓存ID",
    "options": [
      {"id": "选项ID", "question": "完整的具体问题", "sources": ["依据文档"]}
    ]
  }
}
```

调用方显示 `options` 按钮，点击后再次请求同一接口：

```json
{
  "chat_id": "同一个助手ID",
  "session_id": "首次响应的会话ID",
  "messages": [{"role": "user", "content": "选项中的原样 question"}],
  "stream": false,
  "clarification_mode": true,
  "return_diagnostics": true,
  "clarification_selection": {"cache_id": "服务端缓存ID", "option_id": "选项ID"}
}
```

有效且足够的证据会直接复用，`cache_status=hit`。仍会做文档版本与块内容的定点校验，但跳过嵌入和全库排名召回。
缓存过期/账号或会话不匹配/问题被改写/证据不足/知识库变化时，自动重新检索；不会因省一次检索而强行回答。
`cache_status` 可能为 `miss`、`insufficient_evidence`、`corpus_changed`、`evidence_changed` 或 `validation_failed`。

## 流式调用

将 `stream` 设为 `true`，按 SSE 接收 `data:` JSON。普通事件返回答案片段，**`data.final=true` 的事件包含 `data.diagnostics`**；其中 `diagnostics.answer` 是已汇总答案。
不要只检查流式终止标记 `data:true`，该标记不包含诊断信息。

## 查询记录和控制参数

- `GET /api/v1/optimization/records?page=1&query=关键词&status=answered`：每页20条，返回 `total/items/page/is_admin`。可选状态 `answered/clarification/running/error/cancelled`。
- `GET /api/v1/optimization/records/<record_id>`：完整问题、回答、候选块、上下文块、改写、耗时、Prompt。
- `GET /api/v1/optimization/config`：读取追问参数。
- `PUT /api/v1/optimization/config`：管理员修改参数，JSON 可只传需要修改的字段。

```json
{
  "enabled": true,
  "candidate_threshold": 0.12,
  "candidate_limit": 24,
  "max_options": 3,
  "cache_ttl_seconds": 600,
  "decision_timeout_seconds": 8
}
```

普通用户只能查自己的记录，RAGFlow `is_superuser` 管理员能查全局记录并修改配置。错误遵循 RAGFlow 的 JSON `code/message`，调用方需检查 `code`，不能只看 HTTP 状态。

## Python 调用

设置环境变量 `RAGFLOW_BASE_URL`、`RAGFLOW_API_KEY`、`RAGFLOW_CHAT_ID`，运行同目录的 `call_with_diagnostics.py "你的测试集问题"`。
脚本只发送你提供的问题，不生成测试问题。
