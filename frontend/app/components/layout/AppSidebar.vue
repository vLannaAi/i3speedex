<script setup lang="ts">
defineProps<{
  open: boolean
}>()

defineEmits<{
  close: []
}>()

const route = useRoute()

const navItems = [
  { label: 'Dashboard', icon: 'fa-solid fa-gauge', to: '/' },
  { label: 'Vendite', icon: 'fa-solid fa-file-invoice', to: '/sales' },
  { label: 'Acquirenti', icon: 'fa-solid fa-users', to: '/buyers' },
  { label: 'Produttori', icon: 'fa-solid fa-industry', to: '/producers' },
]

function isActive(to: string) {
  if (to === '/') return route.path === '/'
  return route.path.startsWith(to)
}
</script>

<template>
  <aside
    class="fixed top-[var(--header-height)] left-0 bottom-0 w-[var(--sidebar-width)] bg-white border-r border-gray-200 z-35 transition-transform duration-200 overflow-y-auto"
    :class="open ? 'translate-x-0' : '-translate-x-full'"
  >
    <!-- Logo -->
    <div class="p-5 hidden md:block">
      <NuxtLink to="/" class="flex items-center gap-2">
        <span class="text-xl font-bold text-primary-700">i3speedex</span>
      </NuxtLink>
      <p class="text-xs text-gray-400 mt-0.5">Gestione Vendite</p>
    </div>

    <!-- Navigation -->
    <nav class="px-3 py-2">
      <ul class="space-y-1">
        <li v-for="item in navItems" :key="item.to">
          <NuxtLink
            :to="item.to"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
            :class="isActive(item.to)
              ? 'bg-primary-50 text-primary-700'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'"
          >
            <i :class="item.icon" class="text-lg" />
            {{ item.label }}
          </NuxtLink>
        </li>
      </ul>
    </nav>
  </aside>
</template>
