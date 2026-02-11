<script setup lang="ts">
const sidebarMode = ref<'expanded' | 'collapsed' | 'hidden'>('expanded')
const isOffline = ref(false)

const isMobile = ref(false)
if (import.meta.client) {
  const mq = window.matchMedia('(max-width: 768px)')
  isMobile.value = mq.matches
  sidebarMode.value = mq.matches ? 'hidden' : 'expanded'
  mq.addEventListener('change', (e) => {
    isMobile.value = e.matches
    sidebarMode.value = e.matches ? 'hidden' : 'expanded'
  })

  // Offline detection
  isOffline.value = !navigator.onLine
  window.addEventListener('online', () => { isOffline.value = false })
  window.addEventListener('offline', () => { isOffline.value = true })
}

function toggleSidebar() {
  if (isMobile.value) {
    sidebarMode.value = sidebarMode.value === 'hidden' ? 'expanded' : 'hidden'
  } else {
    sidebarMode.value = sidebarMode.value === 'expanded' ? 'collapsed' : 'expanded'
  }
}

// Close sidebar on mobile after navigation
const route = useRoute()
watch(() => route.fullPath, () => {
  if (isMobile.value) sidebarMode.value = 'hidden'
})

const mainMargin = computed(() => {
  if (isMobile.value) return 'ml-0'
  if (sidebarMode.value === 'expanded') return 'ml-[var(--sidebar-width)]'
  if (sidebarMode.value === 'collapsed') return 'ml-[var(--sidebar-width-collapsed)]'
  return 'ml-0'
})
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <AppHeader :sidebar-mode="sidebarMode" @toggle-sidebar="toggleSidebar" />
    <AppSidebar :mode="sidebarMode" @toggle="toggleSidebar" />

    <!-- Overlay for mobile -->
    <Transition name="fade">
      <div
        v-if="isMobile && sidebarMode !== 'hidden'"
        class="fixed inset-0 bg-black/30 z-30"
        @click="sidebarMode = 'hidden'"
      />
    </Transition>

    <!-- Offline banner -->
    <Transition name="slide-down">
      <div
        v-if="isOffline"
        class="fixed top-[var(--header-height)] left-0 right-0 z-35 bg-warning-500 text-white text-sm text-center py-2 px-4"
      >
        <div class="inline-flex items-center gap-2">
          <i class="fa-solid fa-wifi-slash" />
          Connessione assente — Le modifiche non verranno salvate
        </div>
      </div>
    </Transition>

    <main
      class="pt-[var(--header-height)] transition-all duration-200"
      :class="mainMargin"
    >
      <div class="p-4 sm:p-6 max-w-7xl mx-auto">
        <slot />
      </div>
    </main>

    <!-- Toast container -->
    <ToastContainer />
  </div>
</template>
