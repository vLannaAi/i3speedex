<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { completeNewPassword } = useAuth()
const toast = useToast()

const newPassword = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const errorMsg = ref('')

async function handleChange() {
  errorMsg.value = ''
  if (!newPassword.value) {
    errorMsg.value = 'Inserisci la nuova password'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    errorMsg.value = 'Le password non coincidono'
    return
  }
  if (newPassword.value.length < 8) {
    errorMsg.value = 'La password deve avere almeno 8 caratteri'
    return
  }
  loading.value = true
  const result = await completeNewPassword(newPassword.value)
  loading.value = false
  if (!result.success) {
    errorMsg.value = result.error || 'Errore cambio password'
    return
  }
  toast.success('Password aggiornata con successo')
  navigateTo('/')
}
</script>

<template>
  <div>
    <h2 class="text-xl font-semibold text-gray-900 mb-2">Cambia Password</h2>
    <p class="text-sm text-gray-500 mb-6">Devi impostare una nuova password per procedere.</p>

    <form @submit.prevent="handleChange" class="space-y-4">
      <div>
        <label class="label-base" for="newPw">Nuova password</label>
        <input id="newPw" v-model="newPassword" type="password" class="input-base" placeholder="••••••••" autocomplete="new-password">
      </div>
      <div>
        <label class="label-base" for="confirmPw">Conferma password</label>
        <input id="confirmPw" v-model="confirmPassword" type="password" class="input-base" placeholder="••••••••" autocomplete="new-password">
      </div>
      <p class="text-xs text-gray-400">Minimo 8 caratteri, con maiuscole, minuscole e numeri.</p>
      <div v-if="errorMsg" class="text-sm text-danger-600 bg-danger-50 rounded-lg px-3 py-2">{{ errorMsg }}</div>
      <button type="submit" class="btn-primary w-full" :disabled="loading">
        <i v-if="loading" class="fa-solid fa-spinner fa-spin" />
        Imposta password
      </button>
    </form>
  </div>
</template>
