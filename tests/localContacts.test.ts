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

  assert.equal(friends.length, 31)
  assert.equal(enterprise?.memberNum, friends.length)
  assert.equal(departments?.length, 16)
  assert.equal(departments?.filter((item) => !item.parentId).length, 6)
  assert.equal(departments?.find((item) => item.name === '研发中心')?.memberNum, 12)
  assert.deepEqual(
    departments?.filter((item) => item.parentId === 'local-dept-engineering').map((item) => item.name),
    ['前端组', '服务端组', '质量保障组', '数据平台组', '安全运维组']
  )
  assert.equal(new Set(friends.map((item) => item.peerId)).size, friends.length)
  assert.equal(new Set(friends.map((item) => item.username)).size, friends.length)
  assert.equal(new Set(departments?.map((item) => item.id)).size, departments?.length)
  for (const contact of friends) {
    assert.ok(
      departments?.some((department) => department.members?.some((member) => member.userId === contact.peerId)),
      contact.username
    )
  }
  for (const department of departments ?? []) {
    if (department.parentId)
      assert.ok(
        departments?.some((parent) => parent.id === department.parentId),
        department.name
      )
    const included = new Set([department.id])
    for (const child of departments ?? []) if (child.parentId === department.id) included.add(child.id)
    assert.equal(
      department.memberNum,
      (departments ?? [])
        .filter((item) => included.has(item.id))
        .reduce((sum, item) => sum + (item.members?.length ?? 0), 0),
      department.name
    )
  }
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
