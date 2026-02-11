export default defineNuxtRouteMiddleware((to) => {
  const { isAuthenticated, isLoading } = useAuth()

  const publicPages = ['/login', '/forgot-password', '/change-password']
  const isPublic = publicPages.includes(to.path)

  // Still loading session — let it finish
  if (isLoading.value) return

  if (!isAuthenticated.value && !isPublic) {
    return navigateTo('/login')
  }

  if (isAuthenticated.value && isPublic) {
    return navigateTo('/')
  }
})
