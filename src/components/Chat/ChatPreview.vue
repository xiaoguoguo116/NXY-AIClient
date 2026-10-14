<template>
  <div class="preview-chat">
    <aside class="preview-chat__list">
      <div class="preview-chat__filters">
        <button
          v-for="filter in filters"
          :key="filter.icon"
          type="button"
          :class="{ active: filter.active }"
          :title="filter.label">
          <span>{{ filter.icon }}</span>
          <i v-if="filter.dot" />
        </button>
      </div>

      <button
        v-for="(chat, index) in chats"
        :key="chat.name"
        type="button"
        class="preview-chat__item"
        :class="{ active: selected === index }"
        @click="selected = index">
        <span class="preview-chat__avatar" :style="{ background: chat.color }">{{ chat.avatar }}</span>
        <span class="preview-chat__item-main">
          <span class="preview-chat__item-title">
            <strong>{{ chat.name }}</strong>
            <time>{{ chat.time }}</time>
          </span>
          <span class="preview-chat__item-preview">{{ chat.preview }}</span>
        </span>
        <span v-if="chat.unread" class="preview-chat__unread">{{ chat.unread }}</span>
      </button>
    </aside>

    <section class="preview-chat__session">
      <header class="preview-chat__session-header">
        <div>
          <strong>{{ activeChat.name }}</strong>
          <span>{{ activeChat.subtitle }}</span>
        </div>
        <div class="preview-chat__header-actions">
          <button title="聊天记录">◷</button>
          <button title="添加成员">＋</button>
          <button title="更多">•••</button>
        </div>
      </header>

      <main class="preview-chat__messages">
        <div class="preview-chat__notice">界面预览 · 当前未连接服务端</div>
        <div class="preview-chat__day">{{ activeChat.day }}</div>
        <div
          v-for="(message, index) in activeChat.messages"
          :key="`${selected}-${index}`"
          class="preview-chat__message"
          :class="`preview-chat__message--${message.side}`">
          <span
            v-if="message.side === 'left'"
            class="preview-chat__message-avatar"
            :style="{ background: message.color }">
            {{ message.avatar }}
          </span>
          <div>
            <small>{{ message.author }}</small>
            <p>{{ message.text }}</p>
          </div>
          <span v-if="message.side === 'right'" class="preview-chat__message-avatar preview-chat__message-avatar--me">
            EM
          </span>
        </div>
      </main>

      <footer class="preview-chat__composer">
        <div class="preview-chat__tools">
          <button title="字体">A</button>
          <button title="表情">☺</button>
          <button title="截图">✂</button>
          <button title="图片">▧</button>
          <button title="文件">▱</button>
          <button title="收藏">☆</button>
        </div>
        <textarea placeholder="输入消息…" />
        <div class="preview-chat__send-row">
          <span>Enter 发送，Ctrl + Enter 换行</span>
          <button type="button">发送</button>
        </div>
      </footer>
    </section>
  </div>
</template>

<script setup lang="ts">
  const selected = ref(0)

  const filters = [
    { icon: '◷', label: '最近', active: true, dot: true },
    { icon: '♙', label: '联系人', active: false, dot: false },
    { icon: '♧', label: '群聊', active: false, dot: true },
    { icon: '☷', label: '列表', active: false, dot: false },
    { icon: '@', label: '提及', active: false, dot: false }
  ]

  const chats = [
    {
      avatar: '项',
      color: '#17a77b',
      name: '项目工作群',
      subtitle: '8 人 · 产品部 / 软件开发',
      time: '09:28',
      preview: '李然：客户端界面已经更新',
      unread: 3,
      day: '今天 09:28',
      messages: [
        {
          side: 'left',
          avatar: '陈',
          color: '#e1799d',
          author: '陈晓 · 产品部',
          text: '早上好，今天的项目进度和测试结果已经整理好了。'
        },
        {
          side: 'right',
          avatar: 'EM',
          color: '#2f92ed',
          author: '我',
          text: '收到。请把重点问题发到群里，我们下午一起确认。'
        },
        {
          side: 'left',
          avatar: '李',
          color: '#398fd8',
          author: '李然 · 开发部',
          text: '客户端界面已经更新，登录页和聊天页的样式可以开始验收。'
        }
      ]
    },
    {
      avatar: '清',
      color: '#278fd9',
      name: '支付清算组（内部）',
      subtitle: '12 人 · 支付清算项目组',
      time: '09:16',
      preview: '陈晓：[文件] 项目周报.pdf',
      unread: 1,
      day: '今天 09:16',
      messages: [
        {
          side: 'left',
          avatar: '赵',
          color: '#278fd9',
          author: '赵宁 · 清算业务部',
          text: '本周清算项目汇总已经完成，请大家核对负责部分。'
        },
        { side: 'left', avatar: '陈', color: '#e1799d', author: '陈晓 · 产品部', text: '[文件] 项目周报.pdf' },
        { side: 'right', avatar: 'EM', color: '#2f92ed', author: '我', text: '已收到，核对后会在群内反馈。' }
      ]
    },
    {
      avatar: '陈',
      color: '#ec78ab',
      name: '陈晓（190153）',
      subtitle: '产品部 · 产品经理',
      time: '08:57',
      preview: '好的，下午一起确认',
      unread: 0,
      day: '今天 08:57',
      messages: [
        {
          side: 'right',
          avatar: 'EM',
          color: '#2f92ed',
          author: '我',
          text: '登录页的品牌区域已经调整好了，你看下整体效果。'
        },
        {
          side: 'left',
          avatar: '陈',
          color: '#ec78ab',
          author: '陈晓 · 产品部',
          text: '看到了，样式方向没问题。聊天页也按这个视觉继续优化。'
        },
        { side: 'left', avatar: '陈', color: '#ec78ab', author: '陈晓 · 产品部', text: '好的，下午一起确认。' }
      ]
    },
    {
      avatar: '开',
      color: '#398fd8',
      name: '开发部',
      subtitle: '25 人 · 软件开发中心',
      time: '08:32',
      preview: '[图片] 新版界面效果图',
      unread: 0,
      day: '今天 08:32',
      messages: [
        {
          side: 'left',
          avatar: '周',
          color: '#398fd8',
          author: '周工 · 开发部',
          text: '预览模式已改为纯本地运行，不再访问登录接口。'
        },
        {
          side: 'right',
          avatar: 'EM',
          color: '#2f92ed',
          author: '我',
          text: '很好，再检查一下会话切换和窗口启动流程。'
        },
        { side: 'left', avatar: '开', color: '#5c9fdb', author: '开发部', text: '[图片] 新版界面效果图' }
      ]
    },
    {
      avatar: '通',
      color: '#e99948',
      name: '行政服务通知',
      subtitle: '系统通知',
      time: '昨天',
      preview: '今日会议室安排已更新',
      unread: 0,
      day: '昨天 17:40',
      messages: [
        {
          side: 'left',
          avatar: '通',
          color: '#e99948',
          author: '行政服务',
          text: '今日会议室安排已更新，请在应用中查看最新时间。'
        },
        { side: 'left', avatar: '通', color: '#e99948', author: '行政服务', text: '下午的项目评审会议调整至 15:30。' }
      ]
    }
  ]

  const activeChat = computed(() => chats[selected.value])
</script>

<style scoped lang="scss">
  .preview-chat {
    width: 100%;
    height: 100%;
    display: flex;
    overflow: hidden;
    color: #303846;
    background: #fff;

    button,
    textarea {
      font: inherit;
    }
  }

  .preview-chat__list {
    width: 350px;
    flex: 0 0 350px;
    overflow: auto;
    border-right: 1px solid #e4e8ed;
    background: #fff;
  }

  .preview-chat__filters {
    height: 46px;
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 0 13px;
    border-bottom: 1px solid #edf0f3;

    button {
      position: relative;
      width: 34px;
      height: 34px;
      border: 0;
      color: #77818e;
      background: transparent;
      cursor: pointer;

      &.active {
        color: #2f92ed;
        background: #eef6fd;
      }

      i {
        position: absolute;
        top: 5px;
        right: 4px;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #f04444;
      }
    }
  }

  .preview-chat__item {
    position: relative;
    width: 100%;
    min-height: 72px;
    display: flex;
    align-items: center;
    padding: 10px 13px;
    border: 0;
    border-bottom: 1px solid #f0f2f4;
    text-align: left;
    color: #303846;
    background: #fff;
    cursor: pointer;

    &:hover {
      background: #f4f7fa;
    }

    &.active {
      padding-left: 10px;
      border-left: 3px solid #2f92ed;
      background: #e7edf3;
    }
  }

  .preview-chat__avatar {
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    flex: 0 0 44px;
    border-radius: 50%;
    color: #fff;
    font-weight: 600;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06);
  }

  .preview-chat__item-main {
    min-width: 0;
    flex: 1;
    margin-left: 11px;
  }

  .preview-chat__item-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;

    strong {
      overflow: hidden;
      font-size: 14px;
      font-weight: 500;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    time {
      color: #a2aab4;
      font-size: 11px;
      white-space: nowrap;
    }
  }

  .preview-chat__item-preview {
    display: block;
    margin-top: 7px;
    overflow: hidden;
    color: #9099a5;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .preview-chat__unread {
    position: absolute;
    top: 8px;
    left: 45px;
    min-width: 16px;
    height: 16px;
    display: grid;
    place-items: center;
    padding: 0 4px;
    border: 2px solid #fff;
    border-radius: 9px;
    color: #fff;
    background: #f04444;
    font-size: 9px;
  }

  .preview-chat__session {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    background: #f4f6f8;
  }

  .preview-chat__session-header {
    height: 65px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 18px 0 22px;
    border-bottom: 1px solid #e3e7eb;
    background: #f9fafb;

    > div:first-child {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    strong {
      font-size: 16px;
      font-weight: 500;
    }

    span {
      color: #9098a3;
      font-size: 11px;
    }
  }

  .preview-chat__header-actions,
  .preview-chat__tools {
    display: flex;
    align-items: center;
    gap: 4px;

    button {
      min-width: 30px;
      height: 30px;
      border: 0;
      color: #6e7885;
      background: transparent;
      cursor: pointer;
    }
  }

  .preview-chat__messages {
    position: relative;
    flex: 1;
    overflow: auto;
    padding: 26px 28px;
    background: #f4f6f8;
  }

  .preview-chat__notice {
    position: absolute;
    top: 12px;
    right: 18px;
    padding: 4px 9px;
    border: 1px solid #d8e8f8;
    border-radius: 10px;
    color: #6995bf;
    background: #eef7ff;
    font-size: 10px;
  }

  .preview-chat__day {
    margin-bottom: 24px;
    color: #a6adb7;
    font-size: 11px;
    text-align: center;
  }

  .preview-chat__message {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 22px;

    small {
      display: block;
      margin: 0 0 5px 3px;
      color: #8d96a2;
      font-size: 10px;
    }

    p {
      max-width: 470px;
      margin: 0;
      padding: 10px 13px;
      border: 1px solid #e0e4e8;
      border-radius: 3px 10px 10px 10px;
      color: #39414c;
      background: #fff;
      box-shadow: 0 1px 2px rgba(35, 54, 70, 0.04);
      font-size: 13px;
      line-height: 1.65;
    }
  }

  .preview-chat__message--right {
    justify-content: flex-end;
    text-align: right;

    p {
      border-color: #b8daf7;
      border-radius: 10px 3px 10px 10px;
      text-align: left;
      background: #cfeaff;
    }
  }

  .preview-chat__message-avatar {
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    flex: 0 0 34px;
    border-radius: 50%;
    color: #fff;
    background: #e1799d;
    font-size: 12px;
  }

  .preview-chat__message-avatar--me {
    background: #2f92ed;
  }

  .preview-chat__message-avatar--blue {
    background: #398fd8;
  }

  .preview-chat__composer {
    height: 170px;
    display: flex;
    flex-direction: column;
    border-top: 1px solid #dfe4e9;
    background: #fff;
  }

  .preview-chat__tools {
    height: 40px;
    padding: 3px 14px 0;
  }

  .preview-chat__composer textarea {
    flex: 1;
    resize: none;
    padding: 5px 19px;
    border: 0;
    outline: 0;
    color: #3c4652;
    background: #fff;
    font-size: 13px;
  }

  .preview-chat__send-row {
    height: 45px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 14px;
    padding: 0 17px;

    span {
      color: #b2b8c0;
      font-size: 10px;
    }

    button {
      width: 76px;
      height: 30px;
      border: 1px solid #d8dde3;
      border-radius: 3px;
      color: #65717e;
      background: #fff;
      cursor: pointer;
    }
  }
</style>
