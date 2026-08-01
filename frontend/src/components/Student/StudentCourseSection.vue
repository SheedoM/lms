<template>
	<section class="space-y-3">
		<div class="flex items-center justify-between gap-4">
			<div>
				<h2 class="text-xl font-semibold">{{ title }}</h2>
				<p v-if="description" class="mt-1 text-sm text-[var(--ft-muted)]">
					{{ description }}
				</p>
			</div>
			<span
				v-if="courses.length"
				class="rounded-full border border-[var(--ft-border)] px-2.5 py-1 text-xs text-[var(--ft-muted)]"
			>
				{{ courses.length }}
			</span>
		</div>
		<div
			v-if="courses.length"
			class="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3"
		>
			<router-link
				v-for="course in courses"
				:key="course.name"
				:to="{ name: 'CourseDetail', params: { courseName: course.name } }"
				class="ft-panel group flex min-h-36 overflow-hidden rounded-xl transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ft-primary)]"
			>
				<div
					class="w-28 shrink-0 bg-[var(--ft-nav)] bg-cover bg-center sm:w-36"
					:style="course.image ? { backgroundImage: `url('${encodeURI(course.image)}')` } : {}"
				>
					<div
						v-if="!course.image"
						class="grid h-full place-items-center px-3 text-center text-sm font-semibold text-[var(--ft-accent)]"
					>
						{{ course.title }}
					</div>
				</div>
				<div class="flex min-w-0 flex-1 flex-col p-4">
					<h3 class="line-clamp-2 text-base font-semibold">{{ course.title }}</h3>
					<p class="mt-1 line-clamp-2 text-sm text-[var(--ft-muted)]">
						{{ course.short_introduction }}
					</p>
					<div v-if="course.membership" class="mt-auto pt-4">
						<div class="mb-1.5 flex justify-between text-xs text-[var(--ft-muted)]">
							<span>{{ __('Progress') }}</span>
							<span>{{ Math.round(course.membership.progress || 0) }}%</span>
						</div>
						<ProgressBar :progress="course.membership.progress || 0" />
					</div>
					<div v-else class="mt-auto pt-4 text-xs font-medium text-[var(--ft-muted)]">
						{{ __('Available to enroll') }}
					</div>
				</div>
			</router-link>
		</div>
		<div
			v-else
			class="rounded-xl border border-dashed border-[var(--ft-border)] px-5 py-7 text-sm text-[var(--ft-muted)]"
		>
			{{ empty }}
		</div>
	</section>
</template>

<script setup lang="ts">
import ProgressBar from '@/components/ProgressBar.vue'
import type { StudentCourse } from '@/composables/useStudentExperience'

defineProps<{
	title: string
	description?: string
	empty: string
	courses: StudentCourse[]
}>()
</script>
