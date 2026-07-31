<template>
	<router-link
		:to="studentAssessmentRoute(item)"
		class="flex items-start justify-between gap-4 border-b border-[var(--ft-border)] px-1 py-4 transition-colors last:border-b-0 hover:bg-black/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9cff45]"
	>
		<span class="min-w-0">
			<span class="block truncate font-semibold">{{ item.title }}</span>
			<span class="mt-1 block text-xs text-[var(--ft-muted)]">
				{{ item.assessment_type === 'quiz' ? __('Quiz') : __('Assignment') }}
				·
				{{
					item.course_title && item.lesson_title
						? `${item.course_title} · ${item.lesson_title}`
						: item.batch_title
				}}
			</span>
		</span>
		<span
			class="shrink-0 rounded-full bg-black/5 px-2.5 py-1 text-xs font-medium text-[var(--ft-muted)]"
		>
			{{ __(item.status) }}
		</span>
	</router-link>
</template>

<script setup lang="ts">
import {
	studentAssessmentRoute,
	type StudentInlineAssessment,
} from '@/composables/useStudentAssessments'

defineProps<{ item: StudentInlineAssessment }>()
</script>
