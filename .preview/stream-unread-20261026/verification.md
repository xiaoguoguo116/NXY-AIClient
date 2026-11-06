# 流式回复与未读总结交付验证

- 正式程序：`D:/ai/NXY-AIClient/src-tauri/target/release/em.exe`，`pnpm tauri build --no-bundle` 成功。
- 类型检查通过；25 项服务测试通过（`unit.log`）。
- 隔离界面检查通过（`ui-result.json`）：用户同意前不调用模型；仅总结确认的消息；保留输入草稿；普通 AI 流式显示；RAG 预览替换；取消停止更新；拒绝不调用模型；刷新保留阅读状态。
- 正式版原生 HTTP、原有模型设置验证通过（`native-result.json`）：模拟未读消息 2 条，普通 AI 首次文字约 11.2 秒、完成约 12.5 秒、75 次显示更新；出差制度 RAG 首次文字约 31.8 秒、完成约 34.9 秒、45 次更新、6 条依据。首字前仍有模型处理及检索耗时。
- 正式验证结束后删除专用测试会话，原有模型设置和全部原有消息逐项比较保持一致。正式程序继续运行。
- RAG 服务端历史与界面最终答案的 SHA-256 一致，未保存 `preview_answer`（`backend-history-result.json`）。
- 后端源码：`D:/ai/ragflow/custom-v0.27.3/api/db/services/dialog_service.py`。仅显式 `stream_preview=true` 的请求增加预览事件；最终证据核验保持执行。
- 部署镜像：`ragflow-custom:v0.27.3-stream-preview`；上一镜像 `ragflow-custom:v0.27.3-local-followup16` 保留。部署脚本 `deploy_preview.py` 只重建应用容器，未修改数据库 schema 或数据卷。
- 未读总结覆盖当前使用的本地聊天。升级前未记录阅读状态的旧消息作为已读基线。在线 RAG 增加了预览；本次没有真实在线 IM 账号的端到端验收。
