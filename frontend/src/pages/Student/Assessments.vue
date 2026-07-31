<template>
	<div class="mx-auto w-full max-w-7xl px-4 py-6 sm:px-7 lg:px-10 lg:py-9">
		<StudentPageHeader
			:title="__('Assessments')"
			:eyebrow="__('Faragallah Tech')"
			:description="
				__('Quizzes, assignments, and evaluation activity from your courses and groups.')
			"
		/>

		<div class="grid gap-6 xl:grid-cols-2">
			<section class="ft-panel rounded-2xl p-5 sm:p-6">
				<div class="mb-5 flex items-center justify-between gap-4">
					<div>
						<p class="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ft-muted)]">
							{{ __('Learning tasks') }}
						</p>
						<h2 class="mt-1 text-xl font-semibold">{{ __('To do') }}</h2>
					</div>
					<span class="rounded-full border border-[var(--ft-border)] px-2.5 py-1 text-xs text-[var(--ft-muted)]">
						{{ upcomingItems.length }}
					</span>
				</div>
				<div v-if="upcomingItems.length" class="space-y-3">
					<AssessmentRow
						v-for="item in upcomingItems"
						:key="item.key"
						:item="item"
					/>
				</div>
				<div v-else class="rounded-xl border border-dashed border-[var(--ft-border)] p-5 text-sm text-[var(--ft-muted)]">
					{{ __('No quizzes, assignments, or evaluations are waiting for you.') }}
				</div>
			</section>

			<section class="ft-panel rounded-2xl p-5 sm:p-6">
				<div class="mb-5 flex items-center justify-between gap-4">
					<div>
						<p class="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ft-muted)]">
							{{ __('History') }}
						</p>
						<h2 class="mt-1 text-xl font-semibold">{{ __('Completed') }}</h2>
					</div>
					<span class="rounded-full border border-[var(--ft-border)] px-2.5 py-1 text-xs text-[var(--ft-muted)]">
						{{ completedItems.length }}
					</span>
				</div>
				<div v-if="completedItems.length" class="space-y-3">
					<AssessmentRow
						v-for="item in completedItems"
						:key="item.key"
						:item="item"
					/>
				</div>
				<div v-else class="rounded-xl border border-dashed border-[var(--ft-border)] p-5 text-sm text-[var(--ft-muted)]">
					{{ __('Completed quizzes, assignments, and evaluations will appear here.') }}
				</div>
			</section>
		</div>

		<p class="mt-6 text-xs leading-5 text-[var(--ft-muted)]">
			{{ __('Course assessments without a student-readable due date are shown as pending, not assigned an invented schedule.') }}
		</p>
	</div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, inject } from 'vue'
import { createListResource, usePageMeta } from 'frappe-ui'
import { RouterLink } from 'vue-router'
import StudentPageHeader from '@/components/Student/StudentPageHeader.vue'
import { sessionStore } from '@/stores/session'
import {
	studentAssessmentRoute,
	useStudentAssessments,
} from '@/composables/useStudentAssessments'

type AssessmentItem = {
	key: string
	title: string
	type: string
	status: string
	completed?: boolean
	identity?: string
	meta?: string
	route?: any
	href?: string
}

const user = inject<any>('$user')
const dayjs = inject<any>('$dayjs')
const { brand } = sessionStore()
const { items: inlineAssessments } = useStudentAssessments()

const certificateRequests = createListResource({
	doctype: 'LMS Certificate Request',
	filters: { member: user.data?.name, status: ['in', ['Upcoming', 'Completed']] },
	fields: [
		'name',
		'course',
		'course_title',
		'batch_name',
		'batch_title',
		'date',
		'start_time',
		'status',
		'google_meet_link',
	],
	orderBy: 'date desc',
	pageLength: 100,
	auto: true,
})

const certificateItems = computed(() =>
	(certificateRequests.data || []).map((evaluation: any) => ({
		key: `evaluation-${evaluation.name}`,
		title: evaluation.course_title || __('Certificate evaluation'),
		type: __('Certificate evaluation'),
		status: __(evaluation.status),
		meta: [
			evaluation.batch_title
				? `${__('Group')}: ${evaluation.batch_title}`
				: null,
			evaluation.date ? dayjs(evaluation.date).format('DD MMM YYYY') : null,
		]
			.filter(Boolean)
			.join(' · '),
		href:
			evaluation.status === 'Upcoming'
				? evaluation.google_meet_link
				: undefined,
		completed: evaluation.status === 'Completed',
	}))
)
const inlineItems = computed(() =>
	inlineAssessments.value.map((assessment) => ({
		key: `course-${assessment.key}`,
		identity: `${
			assessment.assessment_type === 'quiz'
				? 'LMS Quiz'
				: 'LMS Assignment'
		}:${assessment.assessment_name}`,
		title: assessment.title,
		type:
			assessment.assessment_type === 'quiz'
				? __('Quiz')
				: __('Assignment'),
		status: __(assessment.status),
		meta:
			assessment.course_title && assessment.lesson_title
				? `${assessment.course_title} · ${assessment.lesson_title}`
				: `${__('Group')}: ${assessment.batch_title}`,
		route: studentAssessmentRoute(assessment),
		completed: assessment.completed,
	}))
)
const allItems = computed(() => {
	const combined = [
		...certificateItems.value,
		...inlineItems.value,
	]
	const deduplicated = new Map<string, any>()
	combined.forEach((item: any) =>
		deduplicated.set(item.identity || item.key, item)
	)
	return [...deduplicated.values()]
})
const upcomingItems = computed(() =>
	allItems.value.filter((item: any) => !item.completed)
)
const completedItems = computed(() =>
	allItems.value.filter((item: any) => item.completed)
)

const AssessmentRow = defineComponent({
	props: { item: { type: Object, required: true } },
	setup(props) {
		return () => {
			const content = h(
				'div',
				{
					class:
						'flex items-start justify-between gap-4 rounded-xl border border-[var(--ft-border)] p-4 transition-colors hover:bg-black/[0.02]',
				},
				[
					h('div', { class: 'min-w-0' }, [
						h('div', { class: 'truncate font-semibold' }, props.item.title),
						h(
							'div',
							{ class: 'mt-1 text-xs text-[var(--ft-muted)]' },
							[props.item.type, props.item.meta].filter(Boolean).join(' · ')
						),
					]),
					h(
						'span',
						{
							class:
								'shrink-0 rounded-full bg-black/5 px-2.5 py-1 text-xs font-medium text-[var(--ft-muted)]',
						},
						props.item.status
					),
				]
			)
			if (props.item.route)
				return h(RouterLink, { to: props.item.route }, () => content)
			if (props.item.href)
				return h(
					'a',
					{
						href: props.item.href,
						target: '_blank',
						rel: 'noopener noreferrer',
					},
					content
				)
			return content
		}
	},
})

usePageMeta(() => ({ title: __('Assessments'), icon: brand.favicon }))
</script>
