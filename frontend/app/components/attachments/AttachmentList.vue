<script setup lang="ts">
import type { Attachment } from '~/types'

const props = defineProps<{
  saleId: string
  attachments: Attachment[]
  readonly?: boolean
}>()

const emit = defineEmits<{ refresh: [] }>()

const { deleteAttachment } = useAttachments()
const { formatFileSize, formatDate } = useFormatters()
const toast = useAppToast()

const deleting = ref<string | null>(null)

async function remove(attachmentId: string) {
  deleting.value = attachmentId
  try {
    await deleteAttachment(props.saleId, attachmentId)
    toast.success('Attachment deleted')
    emit('refresh')
  } catch (e: any) {
    toast.error(e.message)
  } finally {
    deleting.value = null
  }
}

const iconMap: Record<string, string> = {
  'application/pdf': 'i-lucide-file-text',
  'image/jpeg': 'i-lucide-image',
  'image/png': 'i-lucide-image',
  'text/plain': 'i-lucide-file-text',
}

function fileIcon(type: string) {
  return iconMap[type] || 'i-lucide-file'
}

function fileIconColor(type: string): string {
  if (type === 'application/pdf') return 'text-(--ui-error)'
  if (type.startsWith('image/')) return 'text-(--ui-primary)'
  return 'text-(--ui-text-dimmed)'
}
</script>

<template>
  <div v-if="attachments.length === 0" class="text-sm text-(--ui-text-muted) text-center py-6">
    No attachments
  </div>
  <ul v-else class="divide-y divide-(--ui-border-muted)">
    <li
      v-for="att in attachments"
      :key="att.attachmentId"
      class="flex items-center gap-3 py-3"
    >
      <UIcon :name="fileIcon(att.fileType)" :class="fileIconColor(att.fileType)" class="text-xl shrink-0" />
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-(--ui-text) truncate">{{ att.fileName }}</p>
        <p class="text-xs text-(--ui-text-dimmed)">{{ formatFileSize(att.fileSize) }} — {{ formatDate(att.createdAt) }}</p>
        <p v-if="att.description" class="text-xs text-(--ui-text-muted)">{{ att.description }}</p>
      </div>
      <UButton
        v-if="!readonly"
        variant="ghost"
        size="xs"
        color="error"
        :icon="deleting === att.attachmentId ? 'i-lucide-loader-circle' : 'i-lucide-trash-2'"
        :disabled="deleting === att.attachmentId"
        @click="remove(att.attachmentId)"
      />
    </li>
  </ul>
</template>
