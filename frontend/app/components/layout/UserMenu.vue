<script setup lang="ts">
const { user, isAdmin, isOperator, logout } = useAuth()
const menuOpen = ref(false)

function handleLogout() {
  menuOpen.value = false
  logout()
}

const roleLabel = computed(() => {
  if (isAdmin.value) return 'Admin'
  if (isOperator.value) return 'Operatore'
  return 'Viewer'
})
</script>

<template>
  <div class="relative">
    <button
      class="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
      @click="menuOpen = !menuOpen"
    >
      <div class="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-semibold">
        {{ user?.username?.charAt(0)?.toUpperCase() || '?' }}
      </div>
      <span class="hidden md:inline text-sm text-gray-700">{{ user?.username }}</span>
      <i class="fa-solid fa-chevron-down text-gray-400 text-sm" />
    </button>

    <!-- Dropdown -->
    <div
      v-if="menuOpen"
      class="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl border border-gray-200 shadow-lg py-1 z-50"
    >
      <div class="px-4 py-3 border-b border-gray-100">
        <p class="text-sm font-medium text-gray-900">{{ user?.username }}</p>
        <p class="text-xs text-gray-500">{{ user?.email }}</p>
        <span class="badge bg-primary-100 text-primary-700 mt-1">{{ roleLabel }}</span>
      </div>
      <button
        class="w-full text-left px-4 py-2.5 text-sm text-danger-600 hover:bg-gray-50 flex items-center gap-2"
        @click="handleLogout"
      >
        <i class="fa-solid fa-right-from-bracket text-base" />
        Esci
      </button>
    </div>

    <!-- Backdrop -->
    <div v-if="menuOpen" class="fixed inset-0 z-40" @click="menuOpen = false" />
  </div>
</template>
