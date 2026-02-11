<script setup lang="ts">
const props = defineProps<{
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasMore?: boolean
}>()

const emit = defineEmits<{
  'update:page': [page: number]
  'update:pageSize': [size: number]
}>()

const pageSizes = [10, 20, 50]

const from = computed(() => props.total > 0 ? (props.page - 1) * props.pageSize + 1 : 0)
const to = computed(() => Math.min(props.page * props.pageSize, props.total > 0 ? props.total : props.page * props.pageSize))
</script>

<template>
  <div class="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-white text-sm">
    <div class="text-gray-500">
      <span v-if="total > 0">{{ from }}–{{ to }}{{ hasMore ? '+' : ` di ${total}` }}</span>
      <span v-else>Nessun risultato</span>
    </div>

    <div class="flex items-center gap-3">
      <select
        :value="pageSize"
        class="text-sm border border-gray-300 rounded-md px-2 py-1"
        @change="emit('update:pageSize', Number(($event.target as HTMLSelectElement).value))"
      >
        <option v-for="s in pageSizes" :key="s" :value="s">{{ s }} / pag.</option>
      </select>

      <div class="flex gap-1">
        <button
          class="btn-ghost btn-sm"
          :disabled="page <= 1"
          @click="emit('update:page', page - 1)"
        >
          <i class="fa-solid fa-chevron-left" />
        </button>
        <button
          class="btn-ghost btn-sm"
          :disabled="!hasMore && page >= totalPages"
          @click="emit('update:page', page + 1)"
        >
          <i class="fa-solid fa-chevron-right" />
        </button>
      </div>
    </div>
  </div>
</template>
