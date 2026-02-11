<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { forgotPassword, confirmForgotPassword } = useAuth()
const toast = useToast()

const step = ref<'email' | 'code'>('email')
const email = ref('')
const code = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const errorMsg = ref('')

async function handleSendCode() {
  errorMsg.value = ''
  if (!email.value) {
    errorMsg.value = 'Enter your email'
    return
  }
  loading.value = true
  const result = await forgotPassword(email.value)
  loading.value = false
  if (!result.success) {
    errorMsg.value = result.error || 'Failed to send code'
    return
  }
  toast.info('Verification code sent to your email')
  step.value = 'code'
}

async function handleResetPassword() {
  errorMsg.value = ''
  if (!code.value || !newPassword.value) {
    errorMsg.value = 'Fill in all fields'
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
  const result = await confirmForgotPassword(email.value, code.value, newPassword.value)
  loading.value = false
  if (!result.success) {
    errorMsg.value = result.error || 'Password reset failed'
    return
  }
  toast.success('Password updated. Please sign in.')
  navigateTo('/login')
}
</script>

<template>
  <div>
    <h2 class="text-xl font-semibold text-gray-900 mb-6">Reset Password</h2>

    <!-- Step 1: Email -->
    <form v-if="step === 'email'" @submit.prevent="handleSendCode" class="space-y-4">
      <div>
        <label class="label-base" for="email">Email</label>
        <input id="email" v-model="email" type="email" class="input-base" placeholder="name@company.com">
      </div>
      <div v-if="errorMsg" class="text-sm text-danger-600 bg-danger-50 rounded-lg px-3 py-2">{{ errorMsg }}</div>
      <button type="submit" class="btn-primary w-full" :disabled="loading">
        <i v-if="loading" class="fa-solid fa-spinner fa-spin" />
        Send code
      </button>
    </form>

    <!-- Step 2: Code + new password -->
    <form v-else @submit.prevent="handleResetPassword" class="space-y-4">
      <div>
        <label class="label-base" for="code">Verification code</label>
        <input id="code" v-model="code" type="text" class="input-base" placeholder="123456">
      </div>
      <div>
        <label class="label-base" for="newPw">New password</label>
        <input id="newPw" v-model="newPassword" type="password" class="input-base" placeholder="••••••••">
      </div>
      <div>
        <label class="label-base" for="confirmPw">Confirm password</label>
        <input id="confirmPw" v-model="confirmPassword" type="password" class="input-base" placeholder="••••••••">
      </div>
      <div v-if="errorMsg" class="text-sm text-danger-600 bg-danger-50 rounded-lg px-3 py-2">{{ errorMsg }}</div>
      <button type="submit" class="btn-primary w-full" :disabled="loading">
        <i v-if="loading" class="fa-solid fa-spinner fa-spin" />
        Reset password
      </button>
    </form>

    <div class="mt-4 text-center">
      <NuxtLink to="/login" class="text-sm link">Back to sign in</NuxtLink>
    </div>
  </div>
</template>
