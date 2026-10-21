import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  answerFromContactKnowledge,
  getResponsibility,
  LOCAL_SELF_ID,
  saveSelfResponsibility
} from '../src/services/contactKnowledge.ts'

test('database access question recommends the responsible colleague with a contact card', () => {
  const storage = { getItem: () => null }
  const answer = answerFromContactKnowledge('数据库访问关系应该找谁开通？', storage)
  assert.equal(answer?.contacts?.[0].userId, 'local-colleague-zhou-yu')
  assert.match(answer?.contacts?.[0].responsibility || '', /数据库访问权限/)
  assert.equal(answer?.references[0].name, '周屿 · 工作职责')
  assert.equal(answerFromContactKnowledge('今天的天气怎么样？', storage), null)
})

test('my editable responsibility persists in the local contact knowledge module', () => {
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    }
  }
  saveSelfResponsibility('负责合同权限审核和合同系统账号开通。', storage)
  assert.equal(getResponsibility(LOCAL_SELF_ID, storage), '负责合同权限审核和合同系统账号开通。')
  assert.equal(answerFromContactKnowledge('合同权限审核应该找谁？', storage)?.contacts?.[0].userId, LOCAL_SELF_ID)
  assert.throws(() => saveSelfResponsibility('a'.repeat(2001), storage), /2000/)
})
