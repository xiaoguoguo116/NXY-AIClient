<template>
  <footer class="work-status">
    <button type="button" class="work-status__item" @click="emit('open-settings')">
      <svg><use href="#ai" /></svg>
      <span>{{ status?.model ? `全局模型 · ${status.model}` : '设置全局模型' }}</span>
    </button>
    <span class="work-status__item">{{ t(`ai.work.approval.${status?.approvalMode || 'ask'}`) }}</span>
  </footer>
</template>

<script setup lang="ts">
  import type { WorkStatus } from '@/types/cmd/work'
  import { useI18n } from 'vue-i18n'
  defineProps<{ status: WorkStatus | null }>()
  const emit = defineEmits<{ 'open-settings': [] }>()
  const { t } = useI18n()
</script>

<style scoped lang="scss">
  .work-status {
    flex: 0 0 34px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-width: 0;
    padding: 0 12px;
    border-top: 1px solid color-mix(in srgb, var(--border-color) 75%, transparent);
    background: color-mix(in srgb, var(--bg-secondary-color) 92%, var(--card-bg-color));
    color: var(--text-secondary-color);
    font-size: 11px;
    user-select: none;
    &__group {
      display: flex;
      align-items: center;
      min-width: 0;
      gap: 6px;
    }
    &__group--right {
      justify-content: flex-end;
    }
    &__item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      padding: 4px 7px;
      border: 0;
      border-radius: 5px;
      background: transparent;
      color: inherit;
      font: inherit;
    }
    button#{&}__item {
      cursor: pointer;
      &:hover {
        color: var(--text-color);
        background: var(--bg-muted-color);
      }
    }
    svg {
      width: 13px;
      height: 13px;
      flex: none;
    }
    &__agent-mark {
      color: var(--text-muted-color);
      font-size: 16px;
      line-height: 1;
      &--ready {
        color: var(--primary-color);
      }
    }
    &__muted {
      color: var(--text-muted-color);
    }
    &__connection {
      color: var(--text-muted-color);
      &--ready {
        color: var(--text-secondary-color);
      }
    }
    &__connection i {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--text-muted-color);
    }
    &__connection--ready i {
      background: var(--primary-color);
      box-shadow: 0 0 8px color-mix(in srgb, var(--primary-color) 65%, transparent);
    }
    @media (max-width: 900px) {
      &__muted,
      &__group--right &__item:nth-child(2) {
        display: none;
      }
    }
  }
</style>
