<script setup lang="ts">
const props = defineProps<{
  page: number
  total: number
  pageSize: number
  showing: string
  pageSizeOptions?: { label: string, value: number }[]
}>()

const emit = defineEmits<{
  'update:page': [value: number]
  'update:pageSize': [value: number]
}>()

const defaultPageSizeOptions = [
  { label: '10', value: 10 },
  { label: '20', value: 20 },
  { label: '50', value: 50 },
  { label: '100', value: 100 },
]

const options = computed(() => props.pageSizeOptions ?? defaultPageSizeOptions)

const currentPage = computed({
  get: () => props.page,
  set: (v) => emit('update:page', v),
})

const currentPageSize = computed({
  get: () => props.pageSize,
  set: (v) => emit('update:pageSize', v),
})
</script>

<template>
  <div class="flex items-center justify-between px-4 py-3 border-t border-(--ui-border)">
    <div class="flex items-center gap-2">
      <span class="text-sm text-(--ui-text-muted)">Rows per page:</span>
      <USelect
        v-model="currentPageSize"
        :items="options"
        class="w-20"
      />
    </div>
    <div class="flex items-center gap-4">
      <span class="text-sm text-(--ui-text-muted)">{{ showing }}</span>
      <UPagination
        v-model="currentPage"
        :total="total"
        :items-per-page="pageSize"
      />
    </div>
  </div>
</template>
