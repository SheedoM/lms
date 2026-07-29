<template>
	<div class="mx-auto w-full max-w-7xl px-4 py-6 sm:px-7 lg:px-10 lg:py-9">
		<StudentPageHeader
			:title="__('Learning')"
			:eyebrow="__('Faragallah Tech')"
			:description="
				__('Your courses, organized by the strongest progress information available.')
			"
		>
			<div class="relative w-full sm:w-72">
				<span
					class="lucide-search pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-[var(--ft-muted)]"
				/>
				<input
					v-model="query"
					type="search"
					:placeholder="__('Search your learning')"
					:aria-label="__('Search your learning')"
					class="h-10 w-full rounded-lg border border-[var(--ft-border)] bg-[var(--ft-surface)] ps-9 pe-3 text-sm outline-none focus:ring-2 focus:ring-[#9cff45]"
				/>
			</div>
		</StudentPageHeader>

		<div v-if="courses.list.loading && !courses.data" class="grid place-items-center py-24">
			<LoadingIndicator class="size-5" />
		</div>
		<div v-else class="space-y-10">
			<StudentCourseSection
				:title="__('Continue where you left off')"
				:description="__('Courses with recorded activity that are not complete yet.')"
				:courses="filtered.continueLearning"
				:empty="__('No course is waiting to be resumed.')"
			/>
			<StudentCourseSection
				:title="__('Learning now')"
				:description="__('Enrolled courses you have not started yet.')"
				:courses="filtered.learningNow"
				:empty="__('No newly enrolled courses right now.')"
			/>
			<StudentCourseSection
				:title="__('Completed')"
				:courses="filtered.completed"
				:empty="__('Completed courses will appear here.')"
			/>
			<StudentCourseSection
				:title="__('Available to me')"
				:description="__('Published courses currently returned by the course catalog.')"
				:courses="filtered.available"
				:empty="__('No additional courses are available right now.')"
			/>
			<div v-if="courses.hasNextPage" class="flex justify-center">
				<Button :loading="courses.list.loading" @click="courses.next()">
					{{ __('Load more') }}
				</Button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { Button, createListResource, LoadingIndicator, usePageMeta } from 'frappe-ui'
import StudentPageHeader from '@/components/Student/StudentPageHeader.vue'
import StudentCourseSection from '@/components/Student/StudentCourseSection.vue'
import {
	categorizeStudentCourses,
	type StudentCourse,
} from '@/composables/useStudentExperience'
import { sessionStore } from '@/stores/session'

const user = inject<any>('$user')
const { brand } = sessionStore()
const query = ref('')

const courses = createListResource({
	doctype: 'LMS Course',
	url: 'lms.lms.utils.get_courses',
	cache: ['student-learning-courses', user.data?.name],
	filters: { published: 1 },
	pageLength: 30,
	auto: true,
})

const categorized = computed(() =>
	categorizeStudentCourses((courses.data || []) as StudentCourse[])
)
const filtered = computed(() => {
	const needle = query.value.trim().toLocaleLowerCase()
	if (!needle) return categorized.value
	const filter = (items: StudentCourse[]) =>
		items.filter((course) =>
			`${course.title || ''} ${course.short_introduction || ''}`
				.toLocaleLowerCase()
				.includes(needle)
		)
	return {
		learningNow: filter(categorized.value.learningNow),
		continueLearning: filter(categorized.value.continueLearning),
		completed: filter(categorized.value.completed),
		available: filter(categorized.value.available),
	}
})

usePageMeta(() => ({ title: __('Learning'), icon: brand.favicon }))
</script>
