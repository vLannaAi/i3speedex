export function useAppToast() {
  const toast = useToast()
  return {
    success: (title: string) => toast.add({ title, color: 'success' as const, icon: 'i-lucide-check-circle' }),
    error: (title: string) => toast.add({ title, color: 'error' as const, icon: 'i-lucide-alert-circle', duration: 6000 }),
    warning: (title: string) => toast.add({ title, color: 'warning' as const, icon: 'i-lucide-alert-triangle' }),
    info: (title: string) => toast.add({ title, color: 'info' as const, icon: 'i-lucide-info' }),
  }
}
