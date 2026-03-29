<!--
/**
 * @registry-id: ProjectsNew
 * @created: 2026-03-02T00:00:00.000Z
 * @last-modified: 2026-03-02T00:00:00.000Z
 * @description: Legacy redirect page from /new to /create
 * @last-fix: [2026-03-02] Initial page creation
 */
-->
<template>
  <div />
</template>

<script setup lang="ts">
// Redirect legacy /notes/projects/new to /notes/projects/create
await navigateTo('/notes/projects/create', { replace: true })
</script>
