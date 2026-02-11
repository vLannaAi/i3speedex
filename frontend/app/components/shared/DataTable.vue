<script setup lang="ts" generic="T extends Record<string, any>">
export interface Column {
  key: string
  label: string
  sortable?: boolean
  align?: 'left' | 'center' | 'right'
  width?: string
}

const props = defineProps<{
  columns: Column[]
  data: T[]
  loading?: boolean
  rowKey?: string
  clickable?: boolean
}>()

defineEmits<{
  rowClick: [row: T]
}>()

const sortKey = ref('')
const sortDir = ref<'asc' | 'desc'>('asc')

function toggleSort(key: string) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
}

const sortedData = computed(() => {
  if (!sortKey.value) return props.data
  const key = sortKey.value
  const dir = sortDir.value === 'asc' ? 1 : -1
  return [...props.data].sort((a, b) => {
    const aVal = a[key]
    const bVal = b[key]
    if (aVal == null) return 1
    if (bVal == null) return -1
    if (typeof aVal === 'number') return (aVal - bVal) * dir
    return String(aVal).localeCompare(String(bVal)) * dir
  })
})
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full">
      <thead>
        <tr class="border-b border-gray-200 bg-gray-50/50">
          <th
            v-for="col in columns"
            :key="col.key"
            class="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
            :class="{
              'text-left': col.align !== 'right' && col.align !== 'center',
              'text-right': col.align === 'right',
              'text-center': col.align === 'center',
              'cursor-pointer hover:text-gray-700 select-none': col.sortable,
            }"
            :style="col.width ? { width: col.width } : {}"
            @click="col.sortable && toggleSort(col.key)"
          >
            <span class="inline-flex items-center gap-1">
              {{ col.label }}
              <template v-if="col.sortable && sortKey === col.key">
                <div :class="sortDir === 'asc' ? 'i-mdi-arrow-up' : 'i-mdi-arrow-down'" class="text-xs" />
              </template>
            </span>
          </th>
        </tr>
      </thead>
      <tbody v-if="loading">
        <tr v-for="i in 5" :key="i" class="border-b border-gray-50">
          <td v-for="col in columns" :key="col.key" class="px-4 py-3">
            <div class="skeleton h-4 rounded" :style="{ width: `${60 + Math.random() * 40}%` }" />
          </td>
        </tr>
      </tbody>
      <tbody v-else-if="sortedData.length === 0">
        <tr>
          <td :colspan="columns.length" class="px-4 py-12 text-center text-sm text-gray-500">
            <slot name="empty">
              <EmptyState title="Nessun risultato" icon="i-mdi-database-off-outline" />
            </slot>
          </td>
        </tr>
      </tbody>
      <tbody v-else>
        <tr
          v-for="(row, idx) in sortedData"
          :key="rowKey ? row[rowKey] : idx"
          class="border-b border-gray-50 last:border-0 transition-colors"
          :class="clickable ? 'hover:bg-gray-50 cursor-pointer' : ''"
          @click="clickable && $emit('rowClick', row)"
        >
          <td
            v-for="col in columns"
            :key="col.key"
            class="px-4 py-3 text-sm"
            :class="{
              'text-right': col.align === 'right',
              'text-center': col.align === 'center',
            }"
          >
            <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]">
              {{ row[col.key] ?? '—' }}
            </slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
