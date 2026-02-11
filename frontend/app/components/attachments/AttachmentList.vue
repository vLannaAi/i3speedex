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
    toast.success('Attachment deleted')
    emit('refresh')
  } catch (e: any) {
    toast.error(e.message)
  } finally {
    deleting.value = null
  }
}

const iconMap: Record<string, string> = {
  'application/pdf': 'fa-solid fa-file-pdf text-danger-500',
  'image/jpeg': 'fa-regular fa-file-image text-primary-500',
  'image/png': 'fa-regular fa-file-image text-primary-500',
  'text/plain': 'fa-regular fa-file-lines text-gray-500',
}

function fileIcon(type: string) {
  return iconMap[type] || 'fa-regular fa-file text-gray-400'
}
</script>

<template>
  <div v-if="attachments.length === 0" class="text-sm text-gray-500 text-center py-6">
    No attachments
  </div>
  <ul v-else class="divide-y divide-gray-100">
    <li
      v-for="att in attachments"
      :key="att.attachmentId"
      class="flex items-center gap-3 py-3"
    >
      <i :class="fileIcon(att.fileType)" class="text-xl shrink-0" />
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
        <i :class="deleting === att.attachmentId ? 'fa-solid fa-spinner fa-spin' : 'fa-regular fa-trash-can'" />
      </button>
    </li>
  </ul>
</template>
