<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { login } = useAuth()
const toast = useToast()

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')

async function handleLogin() {
  errorMsg.value = ''
  if (!email.value || !password.value) {
    errorMsg.value = 'Enter email and password'
    return
  }
  loading.value = true
  const result = await login(email.value, password.value)
  loading.value = false

  if (result.newPasswordRequired) {
    navigateTo('/change-password')
    return
  }
  if (!result.success) {
    errorMsg.value = result.error || 'Authentication failed'
    return
  }
  toast.success('Signed in successfully')
  navigateTo('/')
}
</script>

<template>
  <div>
    <h2 class="text-xl font-semibold text-gray-900 mb-6">Sign In</h2>

    <form @submit.prevent="handleLogin" class="space-y-4">
      <div>
        <label class="label-base" for="email">Email</label>
        <input
          id="email"
          v-model="email"
          type="email"
          class="input-base"
          placeholder="name@company.com"
          autocomplete="email"
        >
      </div>

      <div>
        <label class="label-base" for="password">Password</label>
        <input
          id="password"
          v-model="password"
          type="password"
          class="input-base"
          placeholder="••••••••"
          autocomplete="current-password"
        >
      </div>

      <div v-if="errorMsg" class="text-sm text-danger-600 bg-danger-50 rounded-lg px-3 py-2">
        {{ errorMsg }}
      </div>

      <button
        type="submit"
        class="btn-primary w-full"
        :disabled="loading"
      >
        <i v-if="loading" class="fa-solid fa-spinner fa-spin" />
        {{ loading ? 'Signing in...' : 'Sign In' }}
      </button>
    </form>

    <div class="mt-4 text-center">
      <NuxtLink to="/forgot-password" class="text-sm link">
        Forgot password?
      </NuxtLink>
    </div>
  </div>
</template>
