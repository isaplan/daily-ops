<template>
  <aside class="sticky top-4 flex h-fit w-full shrink-0 flex-col gap-4 self-start rounded-lg bg-[hsl(45,12%,92%)]/90 p-4 backdrop-blur-md md:max-w-xs md:w-72">
    <div v-if="tab === 'members'" class="min-h-0 space-y-3">
      <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500">Connected members</h3>
      <p v-if="!mentionedMembers.length" class="text-sm text-gray-500">
        @mention members in section notes to link them here.
      </p>
      <ul v-else class="space-y-1.5">
        <li
          v-for="member in mentionedMembers"
          :key="member._id"
          class="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
        >
          <NuxtLink :to="`/members/${member._id}`" class="font-medium text-gray-900 hover:underline">
            {{ member.canonicalName }}
          </NuxtLink>
        </li>
      </ul>
      <div v-if="tags.length" class="border-t border-gray-200 pt-3">
        <h4 class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Tags</h4>
        <div class="flex flex-wrap gap-1.5">
          <span
            v-for="tag in tags"
            :key="tag"
            class="rounded-md bg-white px-2 py-1 text-sm text-gray-800 ring-1 ring-gray-200"
          >
            #{{ tag }}
          </span>
        </div>
      </div>
    </div>

    <div v-else-if="tab === 'todos'" class="min-h-0 space-y-2">
      <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500">Todo</h3>
      <p v-if="!todos.length" class="text-sm text-gray-500">No todos yet. Use /todo or @todo … @Todo ends in a section.</p>
      <ul v-else class="space-y-1.5">
        <li
          v-for="todo in todos"
          :key="`${todo.sectionKey}-${todo.id}`"
          class="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
        >
          <p class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{{ todo.sectionLabel }}</p>
          <span :class="todo.checked ? 'text-gray-500 line-through' : 'text-gray-900'">{{ todo.text }}</span>
        </li>
      </ul>
    </div>

    <div v-else-if="tab === 'agreed'" class="min-h-0 space-y-2">
      <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500">Agreed</h3>
      <p v-if="!agrees.length" class="text-sm text-gray-500">No agreements yet. Use /agree in a section.</p>
      <ul v-else class="space-y-1.5">
        <li
          v-for="agree in agrees"
          :key="`${agree.sectionKey}-${agree.id}`"
          class="flex items-start gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
        >
          <UIcon name="i-lucide-handshake" class="mt-0.5 size-4 shrink-0 text-gray-500" />
          <div class="min-w-0">
            <p class="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{{ agree.sectionLabel }}</p>
            {{ agree.text }}
          </div>
        </li>
      </ul>
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { WeeklyReportAgreeItem, WeeklyReportTodoItem } from '~/utils/weeklyReportContentMeta'

const props = defineProps<{
  tab: 'members' | 'todos' | 'agreed'
  todos: WeeklyReportTodoItem[]
  agrees: WeeklyReportAgreeItem[]
  mentionSlugs: string[]
  tags: string[]
}>()

const { data: membersData } = useFetch<{ success: boolean; data: { _id: string; canonicalName: string }[] }>(
  '/api/unified-users',
  { lazy: true },
)

const mentionedMembers = computed(() => {
  const users = membersData.value?.success ? membersData.value.data : []
  const resolved: { _id: string; canonicalName: string }[] = []
  const seen = new Set<string>()
  for (const slug of props.mentionSlugs) {
    const u = users.find(
      (x) =>
        x.canonicalName?.toLowerCase() === slug
        || x.canonicalName?.toLowerCase().replace(/\s+/g, '-') === slug
        || x.canonicalName?.toLowerCase().split(/\s+/)[0] === slug,
    )
    if (u && !seen.has(u._id)) {
      seen.add(u._id)
      resolved.push({ _id: u._id, canonicalName: u.canonicalName })
    }
  }
  return resolved.sort((a, b) => a.canonicalName.localeCompare(b.canonicalName))
})
</script>
