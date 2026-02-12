<script setup lang="ts">
const props = defineProps<{
  saleId: string
}>()

const emit = defineEmits<{ uploaded: [] }>()

const { uploadFile } = useAttachments()
const toast = useAppToast()

const dragging = ref(false)
const uploading = ref(false)
const description = ref('')

async function handleFiles(files: FileList | null) {
  if (!files || files.length === 0) return
  uploading.value = true
  try {
    for (const file of Array.from(files)) {
      await uploadFile(props.saleId, file, description.value || undefined)
    }
    toast.success('File uploaded')
    description.value = ''
    emit('uploaded')
  } catch (e: any) {
    toast.error(e.message)
  } finally {
    uploading.value = false
  }
}

function onDrop(e: DragEvent) {
  dragging.value = false
  handleFiles(e.dataTransfer?.files || null)
}

function onFileSelect(e: Event) {
  handleFiles((e.target as HTMLInputElement).files)
}
</script>

<template>
  <div>
    <div
      class="border-2 border-dashed rounded-lg p-6 text-center transition-colors"
      :class="dragging ? 'border-(--ui-primary) bg-(--ui-bg-accented)' : 'border-(--ui-border) hover:border-(--ui-border-hover)'"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
    >
      <UIcon name="i-lucide-upload" class="text-3xl text-(--ui-text-dimmed) mx-auto mb-2" />
      <p class="text-sm text-(--ui-text-muted)">Drag files here or</p>
      <label>
        <UButton as="span" variant="outline" size="sm" class="mt-2 cursor-pointer">
          Browse
        </UButton>
        <input type="file" multiple class="hidden" @change="onFileSelect">
      </label>
      <div v-if="uploading" class="mt-3 flex items-center justify-center gap-2 text-sm text-(--ui-primary)">
        <UIcon name="i-lucide-loader-circle" class="animate-spin" /> Uploading...
      </div>
    </div>
    <div class="mt-2">
      <UInput v-model="description" placeholder="Description (optional)" />
    </div>
  </div>
</template>
