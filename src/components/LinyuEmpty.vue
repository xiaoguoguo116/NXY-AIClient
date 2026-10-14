<template>
  <div class="em-empty flex h-full w-full justify-center items-center flex-1 bg-[var(--bg-secondary-color)]">
    <div class="em-empty__mark">EM</div>
  </div>
</template>
<script setup lang="ts">
  interface Props {
    size?: number
  }
  const props = withDefaults(defineProps<Props>(), {
    size: 100
  })

  const sizePx = computed(() => `${props.size}px`)
  const fontSizePx = computed(() => `${Math.max(14, Math.round(props.size * 0.24))}px`)
</script>

<style scoped lang="scss">
  .em-empty__mark {
    width: v-bind(sizePx);
    height: v-bind(sizePx);
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid color-mix(in srgb, var(--primary-color) 22%, transparent);
    border-radius: 28%;
    color: color-mix(in srgb, var(--primary-color) 40%, var(--card-bg-color));
    background: color-mix(in srgb, var(--primary-color) 5%, transparent);
    font-size: v-bind(fontSizePx);
    font-weight: 800;
    letter-spacing: 0.08em;
  }
</style>
