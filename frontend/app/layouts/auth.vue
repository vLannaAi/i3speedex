<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
    <div class="w-full max-w-md">
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-primary-600">i3speedex</h1>
        <p class="text-muted mt-1">Sales Management</p>
      </div>
      <UCard>
        <slot />
      </UCard>
    </div>
  </div>
</template>
