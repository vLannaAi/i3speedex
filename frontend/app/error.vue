<script setup lang="ts">
import type { NuxtError } from '#app'

defineProps<{ error: NuxtError }>()

function handleError() {
  clearError({ redirect: '/' })
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 px-4">
    <div class="text-center max-w-md">
      <p class="text-6xl font-bold text-primary-600 mb-4">{{ error.statusCode }}</p>
      <h1 class="text-2xl font-bold text-gray-900 mb-2">
        {{ error.statusCode === 404 ? 'Page not found' : 'An error occurred' }}
      </h1>
      <p class="text-gray-500 mb-6">{{ error.message }}</p>
      <button class="btn-primary" @click="handleError">
        Back to dashboard
      </button>
    </div>
  </div>
</template>
