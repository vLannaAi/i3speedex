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
const toast = useToast()

const deleting = ref<string | null>(null)

async function remove(attachmentId: string) {
  deleting.value = attachmentId
  try {
    await deleteAttachment(props.saleId, attachmentId)
    toast.success('Allegato eliminato')
    emit('refresh')
  } catch (e: any) {
    toast.error(e.message)
  } finally {
    deleting.value = null
  }
}

const iconMap: Record<string, string> = {
  'application/pdf': 'i-mdi-file-pdf-box text-danger-500',
  'image/jpeg': 'i-mdi-file-image text-primary-500',
  'image/png': 'i-mdi-file-image text-primary-500',
  'text/plain': 'i-mdi-file-document-outline text-gray-500',
}

function fileIcon(type: string) {
  return iconMap[type] || 'i-mdi-file-outline text-gray-400'
}
</script>

<template>
  <div v-if="attachments.length === 0" class="text-sm text-gray-500 text-center py-6">
    Nessun allegato
  </div>
  <ul v-else class="divide-y divide-gray-100">
    <li
      v-for="att in attachments"
      :key="att.attachmentId"
      class="flex items-center gap-3 py-3"
    >
      <div :class="fileIcon(att.fileType)" class="text-xl shrink-0" />
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-gray-900 truncate">{{ att.fileName }}</p>
        <p class="text-xs text-gray-400">{{ formatFileSize(att.fileSize) }} — {{ formatDate(att.createdAt) }}</p>
        <p v-if="att.description" class="text-xs text-gray-500">{{ att.description }}</p>
      </div>
      <button
        v-if="!readonly"
        class="btn-ghost btn-sm text-danger-600 p-1"
        :disabled="deleting === att.attachmentId"
        @click="remove(att.attachmentId)"
      >
        <div :class="deleting === att.attachmentId ? 'i-mdi-loading animate-spin' : 'i-mdi-delete-outline'" />
      </button>
    </li>
  </ul>
</template>
