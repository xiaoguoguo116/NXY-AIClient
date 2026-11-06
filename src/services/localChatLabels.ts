import type { LocalChatData } from './localChat.ts'

export const CASE_ANNOUNCEMENT = '请围绕当前事项沟通，明确负责人、时间与待确认问题。'
const OLD_ANNOUNCEMENT = '本群为本地示例，成员与聊天内容均为模拟数据，不会发送真实消息或创建会议、待办及提醒。'
const legacyNames: Record<string, string> = {
  '技术交流群（本地测试）': '技术交流群',
  '待办进度验收群（本地模拟）': '待办进度协作群',
  '未读演示·支付联调（模拟）': '支付联调',
  '未读演示·值班交接（模拟）': '值班交接'
}
const sentences: Record<string, string> = {
  '这里用一组示例讨论演示排班沟通，不代表实际值班安排。': '本群用于沟通排班与交接事项，具体安排以确认结果为准。',
  '这些只是示例聊天，暂不生成真实排班、会议或提醒。': '先整理本次讨论，排班、会议和提醒待确认后再安排。',
  '欢迎来到本地示例交流群，可以用这些记录体验搜索、引用和多选。':
    '欢迎加入日常交流群，相关资料和讨论结论都可以在这里交流。',
  '这些示例成员都只在本机模拟，不会收到真实通知。': '重要事项请明确负责人和时间，便于后续跟进。',
  '收到，先用这几个群体验聊天和记录管理。': '收到，后续按事项分组沟通，保留相关记录。'
}

export function caseText(text: string): string {
  for (const [before, after] of Object.entries(sentences)) text = text.split(before).join(after)
  return text
    .replace(/模拟成员/g, '成员')
    .replace(/测试/g, '验证')
    .replace(/演示/g, '交流')
}

/** Migrate only shipped/known case conversations once; retain IDs and user-created chats. */
export function withBusinessCaseLabels(data: LocalChatData): LocalChatData {
  if (data.caseLabelsVersion === 1) return data
  const conversations = data.conversations.map((chat) => {
    const seeded = /^local-example-v[12]-/.test(chat.id)
    const legacy = Object.prototype.hasOwnProperty.call(legacyNames, chat.name)
    if (!seeded && !legacy) return chat
    return {
      ...chat,
      name: legacy ? legacyNames[chat.name] : chat.name.replace(/（(?:本地示例|模拟项目)）$/, ''),
      ...(chat.announcement === OLD_ANNOUNCEMENT ? { announcement: CASE_ANNOUNCEMENT } : {}),
      messages: chat.messages.map((message) => {
        // Knowledge answers retain their original wording and evidence.
        if (message.assistant === 'ragflow') return message
        const text = caseText(message.text)
        return text === message.text ? message : { ...message, text }
      })
    }
  })
  return { ...data, conversations, caseLabelsVersion: 1 }
}
