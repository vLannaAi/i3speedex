<script setup lang="ts">
import { useTimeAgo } from '@vueuse/core'

const { syncState, isReady, forceFullSync } = useCache()

const syncing = computed(() =>
  syncState.sales.syncing || syncState.buyers.syncing || syncState.producers.syncing,
)

const lastSyncDate = computed(() => {
  const dates = [syncState.sales.lastSync, syncState.buyers.lastSync, syncState.producers.lastSync]
    .filter(Boolean)
    .map(d => new Date(d!).getTime())
  if (dates.length === 0) return null
  return new Date(Math.min(...dates))
})

const timeAgo = useTimeAgo(lastSyncDate as any)

const tooltipText = computed(() => {
  if (!isReady.value) return 'Syncing data...'
  return `Last synced ${timeAgo.value}`
})
</script>

<template>
  <UTooltip :text="tooltipText">
    <UButton
      variant="ghost"
      color="neutral"
      square
      size="xs"
      :icon="syncing ? 'i-lucide-refresh-cw' : 'i-lucide-check-circle'"
      :class="{ 'animate-spin': syncing }"
      @click="forceFullSync()"
    />
  </UTooltip>
</template>
