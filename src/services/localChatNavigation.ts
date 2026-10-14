import { ref } from 'vue'

// In-memory handoff also works when the cached chat page is not currently visible.
export const localChatTarget = ref<{ chatId: string; messageId?: string } | null>(null)
