<template>
  <UModal
    :open="open"
    :ui="{
      overlay: 'bg-black/60',
      content: 'w-[calc(100vw-2rem)] max-w-none sm:w-9/12',
    }"
    @update:open="$emit('update:open', $event)"
  >
    <template #content>
      <div class="p-6 max-h-[85vh] overflow-y-auto bg-white rounded-lg">
        <div class="flex items-start justify-between gap-4 mb-4">
          <h2 class="text-lg font-semibold text-gray-900">Active notification rules</h2>
          <UButton
            size="sm"
            icon="i-lucide-x"
            aria-label="Close"
            class="bg-gray-900! text-white! shrink-0"
            @click="$emit('update:open', false)"
          />
        </div>

        <p class="text-sm text-gray-600 mb-6">{{ OPS_NOTIFICATION_RULES_INTRO }}</p>

        <div class="space-y-6 text-sm text-gray-800">
          <section v-for="section in OPS_NOTIFICATION_RULE_SECTIONS" :key="section.id">
            <h3 class="font-semibold text-gray-900 mb-2">{{ section.title }}</h3>
            <p
              v-for="(para, i) in section.paragraphs"
              :key="`${section.id}-p-${i}`"
              class="text-gray-600 mb-2"
            >
              {{ para }}
            </p>
            <ul
              v-if="section.bullets?.length"
              class="list-disc pl-5 space-y-1.5 text-gray-700"
            >
              <li v-for="(bullet, j) in section.bullets" :key="`${section.id}-b-${j}`">
                {{ bullet }}
              </li>
            </ul>
          </section>
        </div>

        <div class="mt-6 pt-4 border-t border-gray-200">
          <UButton block class="bg-gray-900! text-white!" @click="$emit('update:open', false)">
            Close
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import {
  OPS_NOTIFICATION_RULES_INTRO,
  OPS_NOTIFICATION_RULE_SECTIONS,
} from '~/utils/opsNotificationRulesOverview'

defineProps<{ open: boolean }>()
defineEmits<{ 'update:open': [value: boolean] }>()
</script>
