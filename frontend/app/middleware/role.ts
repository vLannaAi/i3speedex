export default defineNuxtRouteMiddleware(() => {
  const { canWrite } = useAuth()

  if (!canWrite.value) {
    return navigateTo('/')
  }
})
