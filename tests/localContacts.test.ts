import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  getLocalEnterprise,
  getLocalEnterpriseDepartments,
  getLocalFriendList,
  getLocalUser,
  LOCAL_ENTERPRISE_ID
} from '../src/services/localContacts.ts'

test('local directory exposes colleagues and a navigable organization hierarchy', () => {
  const friends = getLocalFriendList()
  const enterprise = getLocalEnterprise(LOCAL_ENTERPRISE_ID)
  const departments = getLocalEnterpriseDepartments(LOCAL_ENTERPRISE_ID)

  assert.equal(friends.length, 13)
  assert.equal(enterprise?.memberNum, friends.length)
  assert.equal(departments?.filter((item) => !item.parentId).length, 5)
  assert.equal(departments?.find((item) => item.name === '研发中心')?.memberNum, 6)
  assert.deepEqual(
    departments?.filter((item) => item.parentId === 'local-dept-engineering').map((item) => item.name),
    ['前端组', '服务端组', '质量保障组']
  )
})

test('every local contact has a local profile and department tag', () => {
  for (const contact of getLocalFriendList()) {
    const profile = getLocalUser(contact.peerId)
    assert.equal(profile?.username, contact.username)
    assert.equal(profile?.tag, contact.tag)
    assert.ok(contact.tag)
  }
})

test('local directory accessors return defensive copies', () => {
  const first = getLocalFriendList()
  first[0].username = 'changed'
  assert.notEqual(getLocalFriendList()[0].username, 'changed')

  const departments = getLocalEnterpriseDepartments(LOCAL_ENTERPRISE_ID)
  assert.ok(departments)
  departments[0].members?.splice(0)
  assert.ok((getLocalEnterpriseDepartments(LOCAL_ENTERPRISE_ID)?.[0].members?.length ?? 0) > 0)
})
