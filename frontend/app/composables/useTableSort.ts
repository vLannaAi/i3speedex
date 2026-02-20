export function useTableSort() {
  const sortKey = ref<string | null>(null)
  const sortDir = ref<'asc' | 'desc' | null>(null)

  function toggleSort(key: string) {
    if (sortKey.value !== key) {
      sortKey.value = key
      sortDir.value = 'asc'
    } else if (sortDir.value === 'asc') {
      sortDir.value = 'desc'
    } else {
      sortKey.value = null
      sortDir.value = null
    }
  }

  function resetSort() {
    sortKey.value = null
    sortDir.value = null
  }

  return { sortKey, sortDir, toggleSort, resetSort }
}
