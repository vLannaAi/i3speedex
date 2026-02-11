<script setup lang="ts">
const props = defineProps<{
  saleId: string
}>()

const emit = defineEmits<{ uploaded: [] }>()

const { uploadFile } = useAttachments()
const toast = useToast()

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
    toast.success('File caricato')
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
      :class="dragging ? 'border-primary-400 bg-primary-50' : 'border-gray-300 hover:border-gray-400'"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
    >
      <i class="fa-solid fa-cloud-arrow-up text-3xl text-gray-400 mx-auto mb-2" />
      <p class="text-sm text-gray-600">Trascina i file qui oppure</p>
      <label class="btn-secondary btn-sm mt-2 cursor-pointer">
        Sfoglia
        <input type="file" multiple class="hidden" @change="onFileSelect">
      </label>
      <div v-if="uploading" class="mt-3 flex items-center justify-center gap-2 text-sm text-primary-600">
        <i class="fa-solid fa-spinner fa-spin" /> Caricamento in corso...
      </div>
    </div>
    <div class="mt-2">
      <FormInput v-model="description" placeholder="Descrizione (opzionale)" />
    </div>
  </div>
</template>
