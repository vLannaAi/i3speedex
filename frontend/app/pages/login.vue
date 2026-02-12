<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { login } = useAuth()
const toast = useAppToast()

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
      <UFormField label="Email" required>
        <UInput
          id="email"
          v-model="email"
          type="email"
          placeholder="name@company.com"
          autocomplete="email"
        />
      </UFormField>

      <UFormField label="Password" required>
        <UInput
          id="password"
          v-model="password"
          type="password"
          placeholder="••••••••"
          autocomplete="current-password"
        />
      </UFormField>

      <div v-if="errorMsg" class="text-sm text-danger-600 bg-danger-50 rounded-lg px-3 py-2">
        {{ errorMsg }}
      </div>

      <UButton
        type="submit"
        block
        :loading="loading"
      >
        {{ loading ? 'Signing in...' : 'Sign In' }}
      </UButton>
    </form>

    <div class="mt-4 text-center">
      <NuxtLink to="/forgot-password" class="text-sm link">
        Forgot password?
      </NuxtLink>
    </div>
  </div>
</template>
