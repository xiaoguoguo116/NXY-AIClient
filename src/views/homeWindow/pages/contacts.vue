<template>
  <div class="contacts">
    <ContactsEnterpriseProfile
      v-if="activeEnterpriseId"
      :enterprise-id="activeEnterpriseId"
      :selected-member-id="activeMemberId"
      @member-selected="openMemberProfile"
      @department-selected="closeMemberProfile"
      @self-selected="openSelfProfile">
      <template v-if="activeMemberId && activeEnterpriseId === LOCAL_ENTERPRISE_ID" #profile>
        <ContactDirectoryProfile :user-id="activeMemberId" @close="closeMemberProfile" />
      </template>
    </ContactsEnterpriseProfile>
    <div v-else class="contacts__empty">{{ t('contacts.emptyEnterprises') }}</div>

    <div
      v-if="activeMemberId && activeEnterpriseId !== LOCAL_ENTERPRISE_ID"
      class="contacts__profile-overlay"
      @click.self="closeMemberProfile">
      <section class="contacts__profile-panel" role="dialog" :aria-label="t('contacts.actions.viewProfile')">
        <button class="contacts__profile-close" type="button" aria-label="关闭" @click="closeMemberProfile">×</button>
        <ContactsFriendProfile :user-id="activeMemberId" />
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
  import ContactsEnterpriseProfile from '@/components/Contacts/detail/ContactsEnterpriseProfile.vue'
  import ContactDirectoryProfile from '@/components/Contacts/detail/ContactDirectoryProfile.vue'
  import ContactsFriendProfile from '@/components/Contacts/detail/ContactsFriendProfile.vue'
  import { LOCAL_SELF_ID } from '@/services/contactKnowledge'
  import { getLocalUser, LOCAL_ENTERPRISE_ID } from '@/services/localContacts'
  import { useHomeTabStore } from '@/stores/app/homeTab'
  import { useContactsStore } from '@/stores/user/contacts'
  import { useI18n } from 'vue-i18n'

  defineOptions({ name: 'contacts' })

  const { t } = useI18n()
  const contactsStore = useContactsStore()
  const homeTabStore = useHomeTabStore()
  const activeMemberId = ref('')

  const activeEnterpriseId = computed(
    () =>
      contactsStore.enterpriseList.find((entry) => entry.peerId === LOCAL_ENTERPRISE_ID)?.peerId ||
      contactsStore.enterpriseList[0]?.peerId ||
      ''
  )

  const openMemberProfile = (userId: string) => {
    activeMemberId.value = userId
  }

  const openSelfProfile = () => {
    activeMemberId.value = LOCAL_SELF_ID
  }

  const closeMemberProfile = () => {
    activeMemberId.value = ''
  }

  const applyContactsPayload = () => {
    const payload = homeTabStore.tabPayload.contacts
    if (!payload) return
    if (payload.peerId === LOCAL_SELF_ID) {
      homeTabStore.consumeTabPayload('contacts')
      openSelfProfile()
      return
    }
    const contact = contactsStore.friendList.find(
      (entry) => entry.id === payload.selectedId || entry.peerId === payload.peerId
    )
    if (!contact) return
    homeTabStore.consumeTabPayload('contacts')
    openMemberProfile(contact.peerId)
  }

  const refreshContacts = () => {
    const peerId = homeTabStore.tabPayload.contacts?.peerId
    if (peerId === LOCAL_SELF_ID || (peerId && getLocalUser(peerId))) {
      contactsStore.ensureLocalDirectory()
    } else {
      contactsStore.fetchAll()
    }
    applyContactsPayload()
  }

  onActivated(() => {
    refreshContacts()
  })

  onDeactivated(closeMemberProfile)

  watch(() => homeTabStore.tabPayload.contacts, applyContactsPayload)
  watch(
    () => contactsStore.friendList,
    () => {
      if (homeTabStore.tabPayload.contacts) applyContactsPayload()
    }
  )
</script>

<style scoped lang="scss">
  .contacts {
    position: relative;
    width: 100%;
    min-width: 0;
    height: 100%;
    overflow: hidden;
    background: #fff;

    &__empty {
      display: grid;
      height: 100%;
      place-items: center;
      color: #66758a;
    }

    &__profile-overlay {
      position: absolute;
      z-index: 10;
      inset: 0;
      display: flex;
      justify-content: flex-end;
      background: rgb(25 45 75 / 22%);
    }

    &__profile-panel {
      position: relative;
      width: min(500px, 100%);
      height: 100%;
      background: #fff;
      box-shadow: -12px 0 35px rgb(32 62 100 / 15%);
      --bg-content-color: #fff;
      --card-bg-color: #f4f8ff;
      --text-color: #17243b;
      --text-secondary-color: #66758a;
      --text-muted-color: #8896aa;
      --divider-color: #e7edf5;
      --primary-color: #347ad9;
    }

    &__profile-close {
      position: absolute;
      z-index: 1;
      top: 15px;
      right: 17px;
      width: 32px;
      height: 32px;
      border: 0;
      border-radius: 8px;
      color: #66758a;
      background: #f3f7fc;
      cursor: pointer;
      font-size: 25px;
      line-height: 28px;
    }
  }
</style>
