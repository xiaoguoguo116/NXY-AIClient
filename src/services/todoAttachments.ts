import type { TodoAttachment } from './localTodos'

export const TODO_ATTACHMENT_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv,.rtf,.odt,.ods,.png,.jpg,.jpeg'
export function validateTodoAttachments(files: Pick<File, 'name' | 'size'>[], existing: TodoAttachment[] = []) {
  if (files.length + existing.length > 10) throw new Error('每项待办最多添加 10 个附件。')
  for (const file of files) {
    const extension = `.${file.name.split('.').pop()?.toLowerCase()}`
    if (!TODO_ATTACHMENT_ACCEPT.split(',').includes(extension))
      throw new Error(`不支持附件“${file.name}”，请选择文档、表格或图片。`)
    if (file.size > 20 * 1024 * 1024) throw new Error(`附件“${file.name}”超过 20 MB。`)
  }
  if ([...files, ...existing].reduce((sum, file) => sum + file.size, 0) > 50 * 1024 * 1024)
    throw new Error('每项待办的附件总大小不能超过 50 MB。')
}

async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('em-todo-attachments-v1', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('files')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error('无法打开附件存储，请检查本机存储权限。'))
  })
}

export async function saveTodoAttachments(files: File[]): Promise<TodoAttachment[]> {
  if (!files.length) return []
  validateTodoAttachments(files)
  const attachments = files.map((file) => ({
    id: crypto.randomUUID(),
    name: file.name,
    size: file.size,
    type: file.type
  }))
  const db = await database()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite')
      files.forEach((file, i) => tx.objectStore('files').put(file, attachments[i].id))
      tx.oncomplete = () => resolve()
      tx.onerror = tx.onabort = () => reject(new Error('附件保存失败，请检查本机可用空间。'))
    })
    return attachments
  } finally {
    db.close()
  }
}

export async function deleteTodoAttachments(ids: string[]) {
  if (!ids.length) return
  const db = await database()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite')
      ids.forEach((id) => tx.objectStore('files').delete(id))
      tx.oncomplete = () => resolve()
      tx.onerror = tx.onabort = () => reject(new Error('附件清理失败。'))
    })
  } finally {
    db.close()
  }
}

export async function readTodoAttachment(id: string): Promise<Blob> {
  const db = await database()
  try {
    return await new Promise<Blob>((resolve, reject) => {
      const request = db.transaction('files').objectStore('files').get(id)
      request.onsuccess = () =>
        request.result instanceof Blob ? resolve(request.result) : reject(new Error('附件已不存在，请重新添加原文件。'))
      request.onerror = () => reject(new Error('附件读取失败。'))
    })
  } finally {
    db.close()
  }
}

export async function downloadTodoAttachment(attachment: TodoAttachment) {
  const blob = await readTodoAttachment(attachment.id)
  const { isTauri } = await import('@tauri-apps/api/core')
  if (isTauri()) {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const path = await save({ defaultPath: attachment.name, title: '保存待办附件' })
    if (path) {
      const { writeFile } = await import('@tauri-apps/plugin-fs')
      await writeFile(path, new Uint8Array(await blob.arrayBuffer()))
    }
  } else {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = attachment.name
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }
}
