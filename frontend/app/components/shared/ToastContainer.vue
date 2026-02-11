<script setup lang="ts">
const { toasts, remove } = useToast()

const iconMap: Record<string, string> = {
  success: 'i-mdi-check-circle',
  error: 'i-mdi-alert-circle',
  warning: 'i-mdi-alert',
  info: 'i-mdi-information',
}

const colorMap: Record<string, string> = {
  success: 'bg-success-50 border-success-500 text-success-700',
  error: 'bg-danger-50 border-danger-500 text-danger-700',
  warning: 'bg-warning-50 border-warning-500 text-warning-700',
  info: 'bg-primary-50 border-primary-500 text-primary-700',
}
</script>

<template>
  <div class="fixed top-20 right-4 z-50 space-y-2 w-80">
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="rounded-lg border-l-4 px-4 py-3 shadow-md flex items-start gap-3"
        :class="colorMap[toast.type]"
      >
        <div :class="iconMap[toast.type]" class="text-lg mt-0.5 shrink-0" />
        <p class="text-sm flex-1">{{ toast.message }}</p>
        <button class="i-mdi-close text-sm opacity-60 hover:opacity-100 shrink-0" @click="remove(toast.id)" />
      </div>
    </TransitionGroup>
  </div>
</template>
