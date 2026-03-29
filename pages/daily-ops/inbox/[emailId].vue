<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold text-gray-900">Email detail</h1>
    <p class="mt-2 text-gray-600">Email ID: {{ emailId }}. Full UI in the Next.js app.</p>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const emailId = computed(() => route.params.emailId as string)
</script>
