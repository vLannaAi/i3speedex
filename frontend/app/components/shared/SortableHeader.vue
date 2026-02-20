<script setup lang="ts">
defineProps<{
  label: string
  columnKey: string
  sortKey: string | null
  sortDir: 'asc' | 'desc' | null
  justify?: 'start' | 'end'
}>()

defineEmits<{
  sort: [key: string]
}>()
</script>

<template>
  <div v-if="justify" :class="`flex justify-${justify} w-full`">
    <button class="inline-flex items-center gap-1 text-white" @click="$emit('sort', columnKey)">
      {{ label }}
      <UIcon v-if="sortKey === columnKey" :name="sortDir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'" class="size-3" />
    </button>
  </div>
  <button v-else class="inline-flex items-center gap-1 text-white" @click="$emit('sort', columnKey)">
    {{ label }}
    <UIcon v-if="sortKey === columnKey" :name="sortDir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'" class="size-3" />
  </button>
</template>
