<script setup lang="ts">
const route = useRoute()

await navigateTo(
  { path: '/daily-ops/staff/productivity', query: route.query },
  { redirectCode: 301 },
)
</script>
