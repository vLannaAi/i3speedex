<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { completeNewPassword } = useAuth()
const toast = useAppToast()

const newPassword = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const errorMsg = ref('')

async function handleChange() {
  errorMsg.value = ''
  if (!newPassword.value) {
    errorMsg.value = 'Enter the new password'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    errorMsg.value = 'Passwords do not match'
    return
  }
  if (newPassword.value.length < 8) {
    errorMsg.value = 'Password must be at least 8 characters'
    return
  }
  loading.value = true
  const result = await completeNewPassword(newPassword.value)
  loading.value = false
  if (!result.success) {
    errorMsg.value = result.error || 'Password change failed'
    return
  }
  toast.success('Password updated successfully')
  navigateTo('/')
}
</script>

<template>
  <div>
    <h2 class="text-xl font-semibold text-gray-900 mb-2">Change Password</h2>
    <p class="text-sm text-gray-500 mb-6">You must set a new password to continue.</p>

    <form @submit.prevent="handleChange" class="space-y-4">
      <UFormField label="New password" required>
        <UInput
          id="newPw"
          v-model="newPassword"
          type="password"
          placeholder="••••••••"
          autocomplete="new-password"
        />
      </UFormField>

      <UFormField label="Confirm password" required>
        <UInput
          id="confirmPw"
          v-model="confirmPassword"
          type="password"
          placeholder="••••••••"
          autocomplete="new-password"
        />
      </UFormField>

      <p class="text-xs text-gray-400">Minimum 8 characters, with uppercase, lowercase and numbers.</p>

      <div v-if="errorMsg" class="text-sm text-danger-600 bg-danger-50 rounded-lg px-3 py-2">{{ errorMsg }}</div>

      <UButton
        type="submit"
        block
        :loading="loading"
      >
        Set password
      </UButton>
    </form>
  </div>
</template>
