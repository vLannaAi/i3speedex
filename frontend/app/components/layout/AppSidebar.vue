<script setup lang="ts">
defineProps<{
  mode: 'expanded' | 'collapsed' | 'hidden'
}>()

const emit = defineEmits<{
  toggle: []
}>()

const route = useRoute()

interface NavItem {
  label: string
  icon: string
  to: string
}

interface NavSection {
  key: string
  label?: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    key: 'main',
    items: [
      { label: 'Dashboard', icon: 'fa-solid fa-gauge', to: '/' },
    ],
  },
  {
    key: 'management',
    label: 'Gestione',
    items: [
      { label: 'Vendite', icon: 'fa-solid fa-file-invoice', to: '/sales' },
      { label: 'Acquirenti', icon: 'fa-solid fa-users', to: '/buyers' },
      { label: 'Produttori', icon: 'fa-solid fa-industry', to: '/producers' },
    ],
  },
]

const openSections = reactive(new Set(navSections.filter(s => s.label).map(s => s.key)))

function toggleSection(key: string) {
  if (openSections.has(key)) openSections.delete(key)
  else openSections.add(key)
}

function isActive(to: string) {
  if (to === '/') return route.path === '/'
  return route.path.startsWith(to)
}
</script>

<template>
  <aside
    class="fixed top-[var(--header-height)] left-0 bottom-0 bg-white border-r border-gray-200 z-35 transition-all duration-200 overflow-hidden flex flex-col"
    :class="[
      mode === 'hidden' ? '-translate-x-full' : 'translate-x-0',
      mode === 'collapsed' ? 'w-[var(--sidebar-width-collapsed)]' : 'w-[var(--sidebar-width)]',
    ]"
  >
    <!-- Logo -->
    <div class="px-4 py-4 border-b border-gray-100 shrink-0" :class="mode === 'collapsed' ? 'text-center' : ''">
      <NuxtLink to="/" class="block">
        <template v-if="mode === 'collapsed'">
          <span class="text-lg font-bold text-primary-700">i3</span>
        </template>
        <template v-else>
          <span class="text-xl font-bold text-primary-700">i3speedex</span>
          <p class="text-xs text-gray-400 mt-0.5">Gestione Vendite</p>
        </template>
      </NuxtLink>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 overflow-y-auto py-2" :class="mode === 'collapsed' ? 'px-2' : 'px-3'">
      <div v-for="section in navSections" :key="section.key" class="mb-1">
        <!-- Section header (expanded mode) -->
        <template v-if="section.label && mode !== 'collapsed'">
          <button
            class="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors"
            @click="toggleSection(section.key)"
          >
            <span class="truncate">{{ section.label }}</span>
            <i
              class="fa-solid text-[10px] transition-transform duration-200"
              :class="openSections.has(section.key) ? 'fa-chevron-down' : 'fa-chevron-right'"
            />
          </button>
        </template>

        <!-- Section divider (collapsed mode) -->
        <div v-else-if="section.label && mode === 'collapsed'" class="my-2 border-t border-gray-200" />

        <!-- Items -->
        <ul
          v-if="!section.label || mode === 'collapsed' || openSections.has(section.key)"
          class="space-y-0.5"
        >
          <li v-for="item in section.items" :key="item.to" class="relative group">
            <NuxtLink
              :to="item.to"
              class="flex items-center rounded-lg text-sm font-medium transition-colors"
              :class="[
                isActive(item.to)
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                mode === 'collapsed'
                  ? 'justify-center w-10 h-10 mx-auto'
                  : 'gap-3 px-3 py-2.5',
              ]"
            >
              <i :class="item.icon" class="text-lg shrink-0" :style="mode === 'collapsed' ? '' : 'width: 20px'" />
              <span v-if="mode !== 'collapsed'" class="truncate">{{ item.label }}</span>
            </NuxtLink>

            <!-- Tooltip (collapsed mode) -->
            <div
              v-if="mode === 'collapsed'"
              class="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-md whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 pointer-events-none"
            >
              {{ item.label }}
              <div class="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
            </div>
          </li>
        </ul>
      </div>
    </nav>

    <!-- Toggle button -->
    <div class="shrink-0 border-t border-gray-100 p-2">
      <button
        class="w-full flex items-center rounded-lg text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
        :class="mode === 'collapsed' ? 'justify-center p-2' : 'gap-2 px-3 py-2'"
        @click="emit('toggle')"
      >
        <i :class="mode === 'collapsed' ? 'fa-solid fa-angles-right' : 'fa-solid fa-angles-left'" />
        <span v-if="mode !== 'collapsed'" class="text-xs">Comprimi</span>
      </button>
    </div>
  </aside>
</template>
