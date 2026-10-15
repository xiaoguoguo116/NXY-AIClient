import {createClient, chunkName, chunkText, formatMs} from './api.js';

const safeId = id => encodeURIComponent(id);
const make = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = String(text);
  return node;
};

/** Framework-neutral UI; answers, options and documents are rendered as text, never HTML. */
export class RagflowChat extends HTMLElement {
  constructor() {
    super(); this.attachShadow({mode:'open'});
    this.messages = []; this.sessions = []; this.sessionId = ''; this.busy = false;
    this.page = 1; this.hasMore = false;
  }
  connectedCallback() { if (!this.rendered) this.renderShell(); }
  disconnectedCallback() { this.controller?.abort(); }

  async configure(config) {
    if (!config.chatId) throw new Error('chatId 必填');
    if (this.busy) throw new Error('请先停止当前请求再切换身份/助手');
    this.connectedCallback(); this.ready = false; this.config = config; this.client = createClient(config);
    this.evidenceTrigger = null; this.$('.inspector').hidden = true;
    this.messages = []; this.sessions = []; this.sessionId = ''; this.page = 1;
    this.$('.title').textContent = config.title || '企业知识助手';
    this.renderMessages(); this.setBusy(true, '连接 RAGFlow…');
    try {
      await this.refreshSessions();
      if (config.sessionId) await this.loadSession(config.sessionId);
      this.ready = true;
      this.error('');
    } catch (error) { this.ready = false; this.error(error.message); throw error; }
    finally { this.setBusy(false); }
  }
  $(selector) { return this.shadowRoot.querySelector(selector); }
  emit(name, detail) { this.dispatchEvent(new CustomEvent(`ragflow-${name}`, {detail, bubbles:true, composed:true})); }
  error(message) { this.$('.error').textContent = message; if (message) this.emit('error', {message}); }
  renderShell() {
    this.rendered = true;
    const style = document.createElement('link'); style.rel = 'stylesheet'; style.href = new URL('./chat.css', import.meta.url).href;
    this.shadowRoot.append(style);
    const shell = make('div', 'shell');
    // Static template only. No user/model strings are interpolated into HTML.
    shell.innerHTML = `<aside class="sidebar"><div class="brand"><span class="mark">✦</span><div><strong>知识问答</strong><div class="eyebrow">POWERED BY RAGFLOW</div></div></div><button class="primary new">＋ 新建对话</button><div class="history-head"><span>云端会话</span><button class="refresh" aria-label="刷新云端会话">刷新</button></div><nav class="sessions" aria-label="历史会话"></nav><button class="more" hidden>加载更多</button><div class="side-note">问题、回答与检索记录保存到 RAGFlow。<br>不在浏览器中持久化聊天内容。</div></aside>
      <main class="main"><header class="top"><button class="mobile-menu" aria-label="打开会话列表">☰</button><h1 class="title">企业知识助手</h1><span class="status" role="status">尚未连接</span></header><div class="scroll"><div class="messages"></div></div><div class="error" role="alert"></div><div class="composer-area"><form class="composer"><textarea aria-label="输入问题" placeholder="输入问题，或补充你想了解的业务场景…" rows="2" maxlength="12000"></textarea><button type="button" class="stop" hidden>停止</button><button type="submit" class="primary send" disabled>发送 ↑</button></form><div class="composer-note"><span>Enter 发送 · Shift + Enter 换行</span><span>回答基于知识库，请核对引用依据</span></div></div></main>
      <section class="inspector" role="region" aria-label="召回依据" hidden><header><div><h2>召回依据</h2><p>查看知识块原文与检索信息</p></div><button class="close-evidence" aria-label="关闭召回依据">×</button></header><div class="inspection-content"></div></section>`;
    this.shadowRoot.append(shell);
    this.$('form').addEventListener('submit', event => {event.preventDefault(); this.send(this.$('textarea').value);});
    this.$('textarea').addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {event.preventDefault(); this.send(this.$('textarea').value);}
    });
    this.$('.stop').onclick = () => this.controller?.abort();
    this.$('.new').onclick = () => this.newSession();
    this.$('.refresh').onclick = () => this.runBusy(() => this.refreshSessions());
    this.$('.more').onclick = () => this.runBusy(() => this.refreshSessions(true));
    this.$('.mobile-menu').onclick = () => this.$('.sidebar').classList.toggle('open');
    this.$('.close-evidence').onclick = () => { this.$('.inspector').hidden = true; this.evidenceTrigger?.focus(); };
    this.shadowRoot.addEventListener('keydown', event => {if(event.key === 'Escape') this.$('.close-evidence').click();});
    this.renderMessages(); this.setBusy(false);
  }
  setBusy(busy, text) {
    this.busy = busy;
    for (const selector of ['.send', '.new', '.refresh', '.more']) this.$(selector).disabled = busy || !this.ready;
    this.$('.stop').hidden = !busy || !this.controller;
    this.$('.status').textContent = text || (busy ? '正在处理…' : this.ready ? '已连接 RAGFlow' : '尚未连接，请检查登录凭证');
    this.shadowRoot.querySelectorAll('.session').forEach(button => button.disabled = busy);
    this.updateOptionButtons();
  }
  async runBusy(fn) {
    if (this.busy || !this.client) return;
    this.setBusy(true); this.error('');
    try { await fn(); } catch(error) { this.error(error.message); } finally { this.setBusy(false); }
  }
  async refreshSessions(more = false) {
    const page = more ? this.page + 1 : 1;
    const data = await this.client.json(`/chats/${safeId(this.config.chatId)}/sessions?page=${page}&page_size=30&orderby=update_time&desc=true`);
    const rows = Array.isArray(data) ? data : data.sessions || [];
    this.sessions = more ? [...this.sessions, ...rows.filter(x => !this.sessions.some(y => y.id === x.id))] : rows;
    this.page = page; this.hasMore = rows.length === 30; this.renderSessions();
  }
  renderSessions() {
    const list = this.$('.sessions'); list.replaceChildren();
    this.sessions.forEach(session => {
      const button = make('button', `session${session.id === this.sessionId ? ' active' : ''}`, session.name || '未命名会话');
      button.title = session.name || session.id; button.disabled = this.busy;
      button.onclick = () => this.runBusy(() => this.loadSession(session.id)); list.append(button);
    });
    if (!this.sessions.length) list.append(make('p', 'empty', '还没有云端会话'));
    this.$('.more').hidden = !this.hasMore;
  }
  newSession() {
    if (this.busy) return;
    this.sessionId = ''; this.messages = []; this.error(''); this.$('.inspector').hidden = true;
    this.$('.sidebar').classList.remove('open'); this.renderSessions(); this.renderMessages();
    this.emit('session', {sessionId:'', chatId:this.config?.chatId}); this.$('textarea').focus();
  }
  async loadSession(id) {
    const data = await this.client.json(`/chats/${safeId(this.config.chatId)}/sessions/${safeId(id)}`);
    this.sessionId = data.id;
    this.messages = (data.messages || data.message || []).filter(x => x.role === 'user' || x.role === 'assistant')
      .map(x => ({...x, content:String(x.content || ''), complete:true}));
    this.$('.inspector').hidden = true; this.$('.sidebar').classList.remove('open');
    this.renderMessages(); this.renderSessions(); this.emit('session', {sessionId:this.sessionId, chatId:this.config.chatId});
  }
  renderMessages() {
    const root = this.$('.messages'); root.replaceChildren();
    if (!this.messages.length) {
      const welcome = make('div', 'welcome');
      welcome.append(make('div','hero','✦'), make('h2','', '从一个问题开始'),
        make('p','', '连接企业知识，找到有依据的答案。\n问题有多种含义时，你可以选择更具体的方向。'));
      const caps = make('div','capabilities');
      ['知识库问答','可点击追问','召回原文可查'].forEach(text => caps.append(make('span','',text)));
      welcome.append(caps); root.append(welcome);
    }
    this.messages.forEach((message, index) => {
      const article = make('article', `message ${message.role}`);
      const label = make('div', 'label'); label.append(make('b','',message.role === 'user' ? '你' : '✦'),
        make('span','',message.role === 'user' ? '我的问题' : '知识助手'));
      const body = make('div','body', message.content || (message.complete ? '' : '正在检索并组织回答…'));
      article.append(label, body); message.bodyNode = body;
      if (message.role === 'assistant' && message.complete) this.renderExtras(article, message, index);
      root.append(article);
    });
    this.updateOptionButtons(); this.scrollBottom();
  }
  renderExtras(article, message, index) {
    const clarification = message.clarification;
    if (clarification?.cache_id && clarification?.options?.length) {
      const card = make('section','clarify'); card.append(make('h3','', '选择你想了解的方向'));
      const options = make('div','options');
      clarification.options.forEach((option, i) => {
        const button = make('button','option'); button.dataset.message = index;
        button.append(make('span','number',String(i+1)));
        const text = make('span','option-text',option.question);
        text.append(make('small','', (option.sources || []).join(' · '))); button.append(text,make('span','','↗'));
        button.onclick = () => this.send(option.question, {cache_id:clarification.cache_id, option_id:option.id});
        options.append(button);
      });
      card.append(options,make('small','', '选项已通过证据充分性审核。点击后优先复用对应原文，证据失效时重新检索；也可以补充说明。')); article.append(card);
    }
    const meta = make('div','meta');
    const timings = message.diagnostics?.timings_ms || {};
    [['总耗时',timings.total_ms],['检索阶段',timings.retrieval_ms],['生成',timings.answer_generation_ms]].forEach(([label,value]) => {
      if (value != null) meta.append(make('span','chip',`${label} ${formatMs(value)}`));
    });
    if (message.optimization?.cache_status === 'hit' || message.diagnostics?.cache_status === 'hit') meta.append(make('span','chip hit','已复用证据'));
    const id = message.optimization?.record_id || message.diagnostics?.record_id;
    if (id || message.reference?.chunks?.length || message.diagnostics) {
      const evidence = make('button','evidence-button','▤ 查看召回块');
      evidence.onclick = () => this.showEvidence(message, evidence); meta.append(evidence);
    }
    article.append(meta);
    if(id) article.append(make('div','record-id',`RAGFlow 记录 · ${id}`));
  }
  updateOptionButtons() {
    this.shadowRoot.querySelectorAll('.option').forEach(button => {
      const index = Number(button.dataset.message);
      button.disabled = this.busy || this.messages.slice(index+1).some(x => x.role === 'user');
    });
  }
  scrollBottom() { const scroll = this.$('.scroll'); scroll.scrollTop = scroll.scrollHeight; }
  async send(question, selection) {
    question = String(question || '').trim();
    if (!question || this.busy) return;
    if (!this.ready) { this.error('尚未连接 RAGFlow，请先完成上方连接配置。'); return; }
    if(question.length > 12000) {this.error('问题不能超过 12000 个字符'); return;}
    this.controller = new AbortController(); this.setBusy(true, '正在提问…'); this.error('');
    this.$('.inspector').hidden = true;
    let assistant;
    try {
      if (!this.sessionId) {
        const session = await this.client.json(`/chats/${safeId(this.config.chatId)}/sessions`,
          {method:'POST',body:{name:question.slice(0,50)},signal:this.controller.signal});
        this.sessionId = session.id; this.emit('session',{sessionId:this.sessionId,chatId:this.config.chatId});
      }
      this.$('textarea').value = '';
      this.messages.push({role:'user',content:question,complete:true});
      assistant = {role:'assistant',content:'',complete:false}; this.messages.push(assistant); this.renderMessages();
      const payload = {chat_id:this.config.chatId, session_id:this.sessionId,
        messages:[{role:'user',content:question}], stream:true, reasoning:0,
        clarification_mode:true, return_diagnostics:true, store_history_messages:true,
        pass_all_history_messages:false, ...(selection ? {clarification_selection:selection} : {})};
      for await (const data of this.client.complete(payload, this.controller.signal)) {
        if (data.final) {
          assistant.content = data.diagnostics?.answer || data.answer || assistant.content;
          Object.assign(assistant,{clarification:data.clarification,diagnostics:data.diagnostics,optimization:data.optimization,
            reference:data.reference,complete:true});
          this.emit('answer', {sessionId:this.sessionId,chatId:this.config.chatId,question,response:data});
        } else if(data.answer) {
          assistant.content += data.answer; assistant.bodyNode.textContent = assistant.content; this.scrollBottom();
        }
        this.$('.status').textContent = data.final ? '回答完成' : '正在生成回答…';
      }
      // The gateway waits for backend stream completion; subsequent refresh reads persisted history.
      this.renderMessages(); await this.refreshSessions();
    } catch (error) {
      if(assistant) {
        assistant.complete = false;
        if (!assistant.content) assistant.bodyNode.textContent = '本次请求未完成，请重新加载会话核对。';
      }
      this.error(error.name === 'AbortError'
        ? '已停止接收。后台可能仍在处理；请刷新云端会话核对，避免重复提问。'
        : error.message);
    } finally {
      this.controller = null; this.setBusy(false); this.$('textarea').focus();
    }
  }
  async showEvidence(message, trigger) {
    this.evidenceTrigger = trigger;
    const panel = this.$('.inspector'); panel.hidden = false; this.$('.close-evidence').focus();
    const root = this.$('.inspection-content'); root.replaceChildren(make('p','empty','正在加载召回记录…'));
    try {
      let diagnostics = message.diagnostics;
      const id = message.optimization?.record_id;
      if(!diagnostics && id) {
        const record = await this.client.json(`/optimization/records/${safeId(id)}`);
        diagnostics = {retrieved_chunks:record.candidates,context_chunks:record.context,timings_ms:record.timings,queries:record.queries,cache_status:record.cache_status};
        message.diagnostics = diagnostics;
      }
      if (this.evidenceTrigger !== trigger) return;
      root.replaceChildren();
      const candidates = diagnostics?.retrieved_chunks || message.reference?.chunks || [];
      const context = diagnostics?.context_chunks || message.reference?.chunks || [];
      const metrics = make('div','meta');
      const labels = {query_preparation_ms:'问题准备',retrieval_ms:'检索阶段',clarification_ms:'追问判断',answer_generation_ms:'答案生成',first_output_ms:'首次输出',total_ms:'总耗时'};
      Object.entries(diagnostics?.timings_ms || {}).forEach(([name,time]) => metrics.append(make('span','chip',`${labels[name] || name}：${formatMs(time)}`)));
      root.append(make('p','query',`实际检索问题：\n${(diagnostics?.queries || []).join('\n') || '历史记录未提供'}`), metrics,
        make('p','query','候选块是本次召回返回的证据；上下文块用于答案组装，不代表全部被引用。相似度不是置信概率。'));
      const tabs = make('div','tabs'), blocks = make('div','blocks');
      const render = (chunks, selected) => {
        tabs.querySelectorAll('button').forEach(b => b.classList.toggle('selected', b === selected)); blocks.replaceChildren();
        chunks.forEach((chunk, i) => {
          const block = make('details','block'); block.open = i === 0;
          block.append(make('summary','',`${i+1}. ${chunkName(chunk)}`));
          const score = name => Number.isFinite(Number(chunk[name])) && chunk[name] != null ? Number(chunk[name]).toFixed(3) : '—';
          block.append(make('div','scores',`相似度 ${score('similarity')} · 向量 ${score('vector_similarity')} · 词项 ${score('term_similarity')}\n块 ID：${chunk.chunk_id || chunk.id || '—'}`),
            make('pre','',chunkText(chunk))); blocks.append(block);
        });
        if (!chunks.length) blocks.append(make('p','empty','当前记录没有这类知识块。'));
      };
      for(const [label,chunks] of [['召回候选',candidates],['上下文',context]]) {
        const tab = make('button','',`${label} (${chunks.length})`); tab.onclick = () => render(chunks,tab); tabs.append(tab);
      }
      root.append(tabs,blocks); render(candidates,tabs.firstChild);
    } catch(error) {root.replaceChildren(make('p','error',error.message));}
  }
}
if(!customElements.get('ragflow-chat')) customElements.define('ragflow-chat', RagflowChat);
