/**
 * Reusable @member and #tag suggestions for note content.
 * Fetches unified users (members) and tags; returns items in shape expected by UEditorMentionMenu.
 * Use in RichTextEditor (and optionally future textarea-based editors) for inline autocomplete.
 */

export type MentionMemberItem = { id: string; label: string; description?: string }
export type MentionTagItem = { id: string; label: string }

export function useMentionTagSuggestions() {
  const memberItems = ref<MentionMemberItem[]>([])
  const tagItems = ref<MentionTagItem[]>([])

  const { data: membersData } = useFetch<{ success: boolean; data: { _id: string; canonicalName: string; slackUsername?: string | null }[] }>(
    '/api/unified-users',
    { lazy: true }
  )
  const { data: tagsData } = useFetch<{ success: boolean; data: string[] }>('/api/tags', { lazy: true })

  watch(
    membersData,
    (d) => {
      if (!d?.success || !Array.isArray(d.data)) return
      memberItems.value = d.data.map((u) => ({
        id: u._id,
        label: u.canonicalName || `User ${u._id.slice(-6)}`,
        description: u.slackUsername ?? undefined,
      }))
    },
    { immediate: true }
  )
  watch(
    tagsData,
    (d) => {
      if (!d?.success || !Array.isArray(d.data)) return
      tagItems.value = d.data.map((t) => ({ id: t, label: t }))
    },
    { immediate: true }
  )

  return { memberItems, tagItems }
}
