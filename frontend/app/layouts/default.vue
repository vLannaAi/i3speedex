<script setup lang="ts">
const sidebarOpen = ref(true)
const isOffline = ref(false)

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
}

// Collapse sidebar on mobile
const isMobile = ref(false)
if (import.meta.client) {
  const mq = window.matchMedia('(max-width: 768px)')
  isMobile.value = mq.matches
  sidebarOpen.value = !mq.matches
  mq.addEventListener('change', (e) => {
    isMobile.value = e.matches
    sidebarOpen.value = !e.matches
  })

  // Offline detection
  isOffline.value = !navigator.onLine
  window.addEventListener('online', () => { isOffline.value = false })
  window.addEventListener('offline', () => { isOffline.value = true })
}

// Close sidebar on mobile after navigation
const route = useRoute()
watch(() => route.fullPath, () => {
  if (isMobile.value) sidebarOpen.value = false
})
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <AppHeader :sidebar-open="sidebarOpen" @toggle-sidebar="toggleSidebar" />
    <AppSidebar :open="sidebarOpen" @close="sidebarOpen = false" />

    <!-- Overlay for mobile -->
    <Transition name="fade">
      <div
        v-if="isMobile && sidebarOpen"
        class="fixed inset-0 bg-black/30 z-30"
        @click="sidebarOpen = false"
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
      :class="sidebarOpen && !isMobile ? 'ml-[var(--sidebar-width)]' : 'ml-0'"
    >
      <div class="p-4 sm:p-6 max-w-7xl mx-auto">
        <slot />
      </div>
    </main>

    <!-- Toast container -->
    <ToastContainer />
  </div>
</template>
