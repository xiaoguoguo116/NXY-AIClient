from pathlib import Path
def edit(path, changes):
    p=Path(path); s=p.read_text(encoding='utf-8')
    for a,b in changes:
        assert a in s, (path,a[:100])
        s=s.replace(a,b)
    p.write_text(s,encoding='utf-8')

edit('src-tauri/src/work/types.rs', [
 ('#[derive(Clone, Debug, Deserialize)]\n#[serde(rename_all = "camelCase")]\npub struct SessionNewInput', '#[derive(Clone, Serialize, Deserialize)]\n#[serde(rename_all = "camelCase")]\npub struct OfficeModelConfig {\n    pub base_url: String,\n    pub model: String,\n    pub api_key: String,\n}\n\n#[derive(Clone, Deserialize)]\n#[serde(rename_all = "camelCase")]\npub struct SessionNewInput'),
 ('pub conversation_id: String,','pub conversation_id: String,\n    pub global_model: Option<OfficeModelConfig>,')])
edit('src-tauri/src/work/manager.rs', [
 ('        for provider in &mut settings.providers {','        settings.active_runtime_id = super::office::ID.into();\n        settings.active_provider_id = None;\n        settings.active_model = None;\n        for provider in &mut settings.providers {'),
 ('vec![super::office::manifest(&self.root), self.detect_reasonix()]','vec![super::office::manifest(&self.root)]'),
 ('        if self.settings.lock().await.active_runtime_id == super::office::ID {\n            super::office::manifest(&self.root)\n        } else {\n            self.detect_reasonix()\n        }','        super::office::manifest(&self.root)'),
 ('if !["reasonix", super::office::ID].contains(&input.active_runtime_id.as_str())','if input.active_runtime_id != super::office::ID'),
 ('''            let settings = self.settings().await;
            let provider = settings
                .providers
                .iter()
                .find(|p| p.enabled && Some(&p.id) == settings.active_provider_id.as_ref())
                .ok_or("WORK_PROVIDER_NOT_CONFIGURED")?;
            let key = read_provider_key(&provider.id).ok_or("WORK_PROVIDER_KEY_REQUIRED")?;
            let model = settings.active_model.as_ref().unwrap_or(&provider.default_model);
''',''),
 ('''            let config = serde_json::json!({
                "baseUrl": provider.base_url, "kind": provider.kind,
                "model": model, "apiKeyEnv": "EM_OFFICE_API_KEY"
            });
''',''),
 ('''                &[
                    ("EM_OFFICE_CONFIG".into(), config.to_string()),
                    ("EM_OFFICE_API_KEY".into(), key),
                ],''','                &[],')])
edit('src-tauri/src/work/commands.rs', [
 ('    let cwd = match input.scope_mode.as_str() {','''    if input.runtime_id != super::office::ID {
        return Err("WORK_RUNTIME_UNSUPPORTED".into());
    }
    let config = input.global_model.as_ref().ok_or("WORK_PROVIDER_NOT_CONFIGURED")?;
    let url = reqwest::Url::parse(&config.base_url).map_err(|_| "WORK_PROVIDER_URL_INVALID")?;
    let local = matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]"));
    if !(url.scheme() == "https" || (url.scheme() == "http" && local))
        || !url.username().is_empty() || url.password().is_some()
        || url.query().is_some() || url.fragment().is_some()
    {
        return Err("WORK_PROVIDER_URL_INVALID".into());
    }
    if config.model.trim().is_empty() { return Err("WORK_MODEL_NOT_FOUND".into()); }
    if url.host_str() == Some("api.deepseek.com") && config.api_key.trim().is_empty() {
        return Err("WORK_PROVIDER_KEY_REQUIRED".into());
    }
    let cwd = match input.scope_mode.as_str() {'''),
 ('json!({ "cwd": cwd, "mcpServers": [] })','json!({ "cwd": cwd, "mcpServers": [], "modelConfig": config })')])
edit('src-tauri/src/work/office_agent.py', [
 ('    def model(self, messages):\n        provider = self.config','    def model(self, messages, provider):'),
 ('secret = os.environ.get(provider.get("apiKeyEnv", ""), "")\n        if not secret:\n            raise ValueError("WORK_PROVIDER_KEY_REQUIRED")','secret = provider.get("apiKey", os.environ.get(provider.get("apiKeyEnv", ""), ""))'),
 ('            headers["Authorization"] = "Bearer " + secret','            if secret:\n                headers["Authorization"] = "Bearer " + secret'),
 ('anthropic = self.config.get("kind") == "anthropic"','anthropic = session["config"].get("kind") == "anthropic"'),
 ('self.model(history)','self.model(history, session["config"])'),
 ('                with self.lock:\n                    self.sessions[sid] = {','                config = params.get("modelConfig", self.config).copy()\n                if not config.get("baseUrl") or not config.get("model"):\n                    raise ValueError("WORK_PROVIDER_NOT_CONFIGURED")\n                with self.lock:\n                    self.sessions[sid] = {"config": config,')])

edit('src/stores/app/workSession.ts', [
 ('  sessionRuntimeId: string','  sessionModelSignature: string\n  sessionRuntimeId: string'),
 ("    sessionRuntimeId: '',","    sessionRuntimeId: '',\n    sessionModelSignature: '',"),
 ("setSessionId(sessionId: string, runtimeId = '', conversationId = '')", "setSessionId(sessionId: string, runtimeId = '', conversationId = '', modelSignature = '')"),
 ('this.$patch({ sessionId, sessionRuntimeId: runtimeId, boundConversationId: conversationId })','this.$patch({ sessionId, sessionRuntimeId: runtimeId, boundConversationId: conversationId, sessionModelSignature: modelSignature })'),
 ("this.$patch({ sessionId: '', boundConversationId: '', sessionRuntimeId: '' })", "this.$patch({ sessionId: '', boundConversationId: '', sessionRuntimeId: '', sessionModelSignature: '' })"),
 ("this.$patch({ sessionId: '', sessionRuntimeId: '', boundConversationId: '' })", "this.$patch({ sessionId: '', sessionRuntimeId: '', boundConversationId: '', sessionModelSignature: '' })")])

p=Path('src/stores/app/workAssistant.ts');s=p.read_text(encoding='utf-8')
s=s.replace("import { defineStore } from 'pinia'", "import { defineStore } from 'pinia'\nimport { readWorkGlobalModel } from '@/services/workGlobalModel'")
s=s.replace('activeRuntimeId: preferences.activeRuntimeId', "activeRuntimeId: 'office'")
s=s.replace('''        // Skills 来自远程接口，失败不应阻断 AI 工作台
        await this.refreshSkills().catch(() => undefined)''','''        this.refreshGlobalModel()''')
start=s.index('    async useChatModel() {');end=s.index('    async removeProvider',start)
s=s[:start]+'''    refreshGlobalModel() {
      let provider: WorkProvider | undefined
      try {
        const config = readWorkGlobalModel()
        provider = { id: 'global', name: '全局模型', kind: 'openai', baseUrl: config.baseUrl,
          models: [config.model], defaultModel: config.model, apiKeyEnv: '',
          hasApiKey: Boolean(config.apiKey), enabled: true }
      } catch { /* An incomplete global configuration must not reuse a stale provider. */ }
      this.$patch({
        activeRuntimeId: 'office', providers: provider ? [provider] : [],
        activeProviderId: provider?.id, activeModel: provider?.defaultModel,
        status: this.status ? { ...this.status, provider, model: provider?.defaultModel, installedSkills: 0 } : null
      })
    },
'''+s[end:]
s=s.replace('this.$patch({ runtimes, status })', 'this.$patch({ runtimes, status })\n      this.refreshGlobalModel()')
s=s.replace('activeRuntimeId: input?.activeRuntimeId ?? this.activeRuntimeId', "activeRuntimeId: 'office'")
s=s.replace('activeProviderId: input?.activeProviderId ?? this.activeProviderId', 'activeProviderId: undefined')
s=s.replace('activeModel: input?.activeModel ?? this.activeModel', 'activeModel: undefined')
s=s.replace('''        workMode: preferences.workMode
      })''','''        workMode: preferences.workMode
      })
      this.refreshGlobalModel()''')
p.write_text(s,encoding='utf-8')

p=Path('src/views/homeWindow/pages/ai.vue');s=p.read_text(encoding='utf-8')
start=s.index('            <button type="button" :class="{ active: activeView === \'skills\' }"');end=s.index('            </button>',start)+len('            </button>\n');s=s[:start]+s[end:]
start=s.index('          <template v-if="activeView === \'skills\'">');end=s.index('          <template v-else>',start)+len('          <template v-else>');s=s[:start]+'          <template>'+s[end:]
start=s.index('                  <n-select\n');end=s.index('                  <div class="workbench__quick-grid">',start);s=s[:start]+s[end:]
s=s.replace("  import SkillsMarket from '@/components/AI/Work/SkillsMarket.vue'\n",'')
s=s.replace("  import * as workService from '@/services/workService'", "  import * as workService from '@/services/workService'\n  import { readWorkGlobalModel, workModelSignature, type WorkGlobalModel } from '@/services/workGlobalModel'")
s=s.replace("  const activeProvider = computed(() => store.providers.find((item) => item.id === store.activeProviderId))\n",'')
s=s.replace("const openSettings = () => createSetWinodw('work')", "const openSettings = () => createSetWinodw('aiModel')")
start=s.index('  const useChatModel = async');end=s.index('  const ensureSession = async',start);s=s[:start]+s[end:]
s=s.replace('    runId: string\n  ) => {', '    runId: string,\n    globalModel: WorkGlobalModel\n  ) => {\n    const signature = await workModelSignature(globalModel)')
s=s.replace('sessionStore.sessionRuntimeId !== runtimeId)', 'sessionStore.sessionRuntimeId !== runtimeId || sessionStore.sessionModelSignature !== signature)')
s=s.replace("scopeMode === 'workspace' ? cwd : undefined\n", "scopeMode === 'workspace' ? cwd : undefined,\n        globalModel\n")
s=s.replace('sessionStore.setSessionId(session.sessionId, runtimeId, targetConversationId)', 'sessionStore.setSessionId(session.sessionId, runtimeId, targetConversationId, signature)')
s=s.replace('    workError.value = null\n    try {\n      if (!runtime.value?.installed)', '    workError.value = null\n    let globalModel: WorkGlobalModel\n    try {\n      store.refreshGlobalModel()\n      globalModel = readWorkGlobalModel()\n      if (!runtime.value?.installed)')
start=s.index("      if (!activeProvider.value) throw");end=s.index("      if (store.scopeMode === 'workspace'",start);s=s[:start]+s[end:]
s=s.replace('ensureSession(runtimeId, scopeMode, targetConversationId, workspacePath, runId)', 'ensureSession(runtimeId, scopeMode, targetConversationId, workspacePath, runId, globalModel)')
s=s.replace("else if (action === 'settings') openSettings()", "else if (action === 'settings') {\n      if (workError.value?.code.startsWith('WORK_OFFICE_') || workError.value?.code.startsWith('WORK_RUNTIME_')) createSetWinodw('work')\n      else openSettings()\n    }")
s=s.replace('  onMounted(async () => {', "  const refreshGlobalModel = () => store.refreshGlobalModel()\n  onMounted(async () => {\n    window.addEventListener('storage', refreshGlobalModel)\n    window.addEventListener('focus', refreshGlobalModel)")
s=s.replace('  onActivated(() => {', '  onActivated(() => {\n    store.refreshGlobalModel()')
s=s.replace('  onBeforeUnmount(() => {', "  onBeforeUnmount(() => {\n    window.removeEventListener('storage', refreshGlobalModel)\n    window.removeEventListener('focus', refreshGlobalModel)")
p.write_text(s,encoding='utf-8')
edit('src/views/SetWindow/pages/ai-model.vue', [('所有本地聊天和群共用','本地聊天、群聊、任务助手和合规助手共用')])
