<script setup lang="ts">
const props = withDefaults(defineProps<{
  summaryStyle?: 'elevated' | 'primary'
  // Declaring data as any[] so UTable infers TData = any (row.original stays typed as any)
  data?: any[]
}>(), {
  summaryStyle: 'elevated',
})

defineOptions({ inheritAttrs: false })

// Cast as any because Nuxt UI v4 typing for th sub-properties is overly narrow
const tableUi = {
  root: '!overflow-visible w-full',
  base: 'w-full',
  thead: 'sticky top-16 z-10 bg-primary text-white font-normal text-sm',
  th: { color: 'text-white', base: 'first:!pl-9' },
  tr: 'hover:bg-(--ui-bg-accented) transition-colors cursor-pointer',
  td: { base: 'whitespace-nowrap first:!pl-9' },
} as any

const summaryBg = computed(() =>
  props.summaryStyle === 'primary'
    ? 'color-mix(in srgb, var(--color-primary-500) 10%, var(--ui-bg))'
    : 'var(--ui-bg-elevated)',
)
const summaryPosition = computed(() =>
  props.summaryStyle === 'primary' ? 'sticky' : 'static',
)
const summaryFontWeight = computed(() =>
  props.summaryStyle === 'primary' ? '400' : '600',
)
const summaryTop = computed(() =>
  props.summaryStyle === 'primary' ? 'calc(var(--ui-header-height) + 45px)' : 'auto',
)
</script>

<template>
  <div class="rounded-none ring-0 sm:rounded-lg sm:ring ring-(--ui-border) bg-(--ui-bg)">
    <!-- data declared as explicit prop (any[]) so UTable infers TData=any; remaining attrs (columns, loading, @select) forwarded via $attrs -->
    <UTable v-bind="$attrs" :data="props.data" sticky :ui="tableUi">
      <template v-for="(_, name) in $slots" :key="name" #[name]="slotProps">
        <slot :name="name" v-bind="slotProps ?? {}" />
      </template>
    </UTable>
    <slot name="after" />
  </div>
</template>

<style scoped>
@media (min-width: 640px) {
  :deep(thead tr:first-child th:first-child) { border-top-left-radius: var(--radius-lg); }
  :deep(thead tr:first-child th:last-child) { border-top-right-radius: var(--radius-lg); }
  :deep(tbody tr:last-child td:first-child) { border-bottom-left-radius: var(--radius-lg); }
  :deep(tbody tr:last-child td:last-child) { border-bottom-right-radius: var(--radius-lg); }
}

:deep(tbody tr:first-child td) {
  position: v-bind(summaryPosition) !important;
  top: v-bind(summaryTop);
  z-index: 9;
  background: v-bind(summaryBg) !important;
  font-weight: v-bind(summaryFontWeight);
}
:deep(tbody tr:first-child) { cursor: default; }
:deep(tbody tr:first-child:hover td) {
  background: v-bind(summaryBg) !important;
}
</style>
