// Read-only LevelDB inspection. Never opens the DB for writes and never prints
// API keys, chat content, full endpoints or unrecognized values.
const fs = require('node:fs')
const path = require('node:path')
const directory = 'C:/Users/94719/AppData/Local/chat.linyu/EBWebView/Default/Local Storage/leveldb'
function variable(buffer, cursor) {
  let result = 0, factor = 1
  for (let n = 0; n < 10; n++) {
    if (cursor.i >= buffer.length) throw Error('Truncated varint')
    const byte = buffer[cursor.i++]
    result += (byte & 127) * factor
    if (byte < 128) return result
    factor *= 128
  }
  throw Error('Invalid varint')
}
function slice(buffer, cursor) {
  const length = variable(buffer, cursor), start = cursor.i
  cursor.i += length
  if (cursor.i > buffer.length) throw Error('Truncated field')
  return buffer.subarray(start, cursor.i)
}
function snappy(input) {
  const cursor = { i: 0 }, output = Buffer.alloc(variable(input, cursor))
  let pos = 0
  while (cursor.i < input.length) {
    const tag = input[cursor.i++], kind = tag & 3
    let length, offset
    if (!kind) {
      length = tag >>> 2
      if (length < 60) length++
      else {
        const bytes = length - 59
        length = input.readUIntLE(cursor.i, bytes) + 1
        cursor.i += bytes
      }
      input.copy(output, pos, cursor.i, cursor.i + length)
      cursor.i += length
    } else {
      if (kind === 1) {
        length = 4 + ((tag >>> 2) & 7)
        offset = ((tag & 224) << 3) | input[cursor.i++]
      } else {
        length = 1 + (tag >>> 2)
        offset = input.readUIntLE(cursor.i, kind === 2 ? 2 : 4)
        cursor.i += kind === 2 ? 2 : 4
      }
      if (offset <= 0 || offset > pos) throw Error('Invalid copy')
      for (let i = 0; i < length; i++) output[pos + i] = output[pos + i - offset]
    }
    pos += length
    if (pos > output.length) throw Error('Invalid decoded length')
  }
  if (pos !== output.length) throw Error('Incomplete decompression')
  return output
}
function entries(block) {
  const limit = block.length - 4 - block.readUInt32LE(block.length - 4) * 4
  const cursor = { i: 0 }, result = []
  let previous = Buffer.alloc(0)
  while (cursor.i < limit) {
    const shared = variable(block, cursor), suffix = variable(block, cursor), size = variable(block, cursor)
    if (shared > previous.length || cursor.i + suffix + size > limit) throw Error('Invalid entry')
    const key = Buffer.concat([previous.subarray(0, shared), block.subarray(cursor.i, cursor.i + suffix)])
    cursor.i += suffix
    const value = block.subarray(cursor.i, cursor.i + size)
    cursor.i += size
    result.push([key, value])
    previous = key
  }
  return result
}
function records(buffer) {
  const result = []
  let fragments = []
  for (let blockStart = 0; blockStart < buffer.length; blockStart += 32768) {
    let pos = blockStart
    const end = Math.min(blockStart + 32768, buffer.length)
    while (pos + 7 <= end) {
      const size = buffer.readUInt16LE(pos + 4), type = buffer[pos + 6]
      pos += 7
      if (!size && !type) break
      if (pos + size > end) throw Error('Truncated log')
      const body = buffer.subarray(pos, pos + size)
      pos += size
      if (type === 1) result.push(body)
      else if (type === 2) fragments = [body]
      else if (type === 3) fragments.push(body)
      else if (type === 4) { fragments.push(body); result.push(Buffer.concat(fragments)); fragments = [] }
    }
  }
  return result
}
const liveFiles = new Set()
const manifest = fs.readFileSync(path.join(directory, 'CURRENT'), 'utf8').trim()
for (const record of records(fs.readFileSync(path.join(directory, manifest)))) {
  const cursor = { i: 0 }
  while (cursor.i < record.length) {
    const tag = variable(record, cursor)
    if (tag === 1) slice(record, cursor)
    else if ([2, 3, 4, 9].includes(tag)) variable(record, cursor)
    else if (tag === 5) { variable(record, cursor); slice(record, cursor) }
    else if (tag === 6) { variable(record, cursor); liveFiles.delete(variable(record, cursor)) }
    else if (tag === 7) {
      variable(record, cursor)
      liveFiles.add(variable(record, cursor))
      variable(record, cursor)
      slice(record, cursor); slice(record, cursor)
    } else throw Error(`Unsupported manifest tag ${tag}`)
  }
}
const latest = new Map()
function collect(key, value, sequence, type) {
  const id = key.toString('hex'), old = latest.get(id)
  if (!old || old.sequence < sequence) latest.set(id, { key, value, sequence, type })
}
for (const filename of fs.readdirSync(directory)) {
  const table = /^(\d+)\.ldb$/.exec(filename)
  if (table && liveFiles.has(Number(table[1]))) {
    const file = fs.readFileSync(path.join(directory, filename))
    function block(offset, size) {
      const data = file.subarray(offset, offset + size), compression = file[offset + size]
      if (compression === 0) return data
      if (compression === 1) return snappy(data)
      throw Error('Unsupported block compression')
    }
    const footer = { i: file.length - 48 }
    variable(file, footer); variable(file, footer)
    const offset = variable(file, footer), size = variable(file, footer)
    for (const [, handle] of entries(block(offset, size))) {
      const cursor = { i: 0 }
      const dataOffset = variable(handle, cursor), dataSize = variable(handle, cursor)
      for (const [key, value] of entries(block(dataOffset, dataSize))) {
        const trailer = key.readBigUInt64LE(key.length - 8)
        collect(key.subarray(0, -8), value, Number(trailer >> 8n), Number(trailer & 255n))
      }
    }
  } else if (/^\d+\.log$/.test(filename)) {
    for (const batch of records(fs.readFileSync(path.join(directory, filename)))) {
      const sequence = Number(batch.readBigUInt64LE(0)), count = batch.readUInt32LE(8), cursor = { i: 12 }
      for (let i = 0; i < count; i++) {
        const type = batch[cursor.i++], key = slice(batch, cursor)
        const value = type === 1 ? slice(batch, cursor) : Buffer.alloc(0)
        collect(key, value, sequence + i, type)
      }
    }
  }
}
function decode(value) {
  if (value[0] === 0) return value.subarray(1).toString('utf16le')
  if (value[0] === 1) return value.subarray(1).toString('latin1')
  throw Error('Unknown Chromium string encoding')
}
const report = {}
for (const entry of latest.values()) {
  if (entry.key[0] !== 95) continue
  const separator = entry.key.indexOf(0)
  if (separator < 0) continue
  const origin = entry.key.subarray(1, separator).toString('utf8'), key = decode(entry.key.subarray(separator + 1))
  if (!['em.local-ai.v1', 'em.local-ai-key.v1', 'em.ragflow-credential.v1', 'em.local-chat.v1'].includes(key)) continue
  const output = report[origin] ||= {}
  if (!entry.type) { output[key] = { deleted: true }; continue }
  const value = decode(entry.value)
  if (key === 'em.local-ai.v1') {
    try {
      const config = JSON.parse(value)
      output[key] = { configured: !!config.baseUrl && !!config.model, model: config.model,
        host: config.baseUrl ? new URL(config.baseUrl).hostname : '', contextCount: config.contextCount }
    } catch { output[key] = { invalid: true } }
  } else if (key === 'em.local-chat.v1') {
    try {
      const data = JSON.parse(value)
      output[key] = { conversations: data.conversations?.length, exampleVersion: data.exampleGroupsVersion }
    } catch { output[key] = { invalid: true } }
  } else output[key] = { present: !!value.trim() }
}
console.log(JSON.stringify({ activeTables: [...liveFiles], origins: report }, null, 2))
module.exports.storageForOrigin = function (origin) {
  const result = {}
  for (const entry of latest.values()) {
    if (!entry.type || entry.key[0] !== 95) continue
    const separator = entry.key.indexOf(0)
    if (separator < 0 || entry.key.subarray(1, separator).toString('utf8') !== origin) continue
    result[decode(entry.key.subarray(separator + 1))] = decode(entry.value)
  }
  return result
}
