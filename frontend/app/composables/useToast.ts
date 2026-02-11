export interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  duration?: number
}

const toasts = ref<Toast[]>([])
let nextId = 0

export function useToast() {
  function add(message: string, type: Toast['type'] = 'info', duration = 4000) {
    const id = nextId++
    toasts.value.push({ id, message, type, duration })
    if (duration > 0) {
      setTimeout(() => remove(id), duration)
    }
  }

  function remove(id: number) {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  function success(message: string) { add(message, 'success') }
  function error(message: string) { add(message, 'error', 6000) }
  function warning(message: string) { add(message, 'warning') }
  function info(message: string) { add(message, 'info') }

  return {
    toasts: computed(() => toasts.value),
    add,
    remove,
    success,
    error,
    warning,
    info,
  }
}
