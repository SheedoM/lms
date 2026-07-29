<template>
	<div class="mx-auto w-full max-w-7xl px-4 py-6 sm:px-7 lg:px-10 lg:py-9">
		<StudentPageHeader
			:title="__('Assessments')"
			:eyebrow="__('Faragallah Tech')"
			:description="
				__('Upcoming evaluation appointments and assessment activity available from your courses and groups.')
			"
		/>

		<div class="grid gap-6 xl:grid-cols-2">
			<section class="ft-panel rounded-2xl p-5 sm:p-6">
				<div class="mb-5 flex items-center justify-between gap-4">
					<div>
						<p class="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ft-muted)]">
							{{ __('Scheduled') }}
						</p>
						<h2 class="mt-1 text-xl font-semibold">{{ __('Upcoming') }}</h2>
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
					{{ __('No upcoming evaluations or pending group assessments are available.') }}
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
					{{ __('Completed quizzes, assignments, and evaluations will appear here when exposed by the current APIs.') }}
				</div>
			</section>
		</div>

		<p class="mt-6 text-xs leading-5 text-[var(--ft-muted)]">
			{{ __('Course assessments without a student-readable due date are shown as pending, not assigned an invented schedule.') }}
		</p>
	</div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, inject, ref, watch } from 'vue'
import { call, createListResource, createResource, usePageMeta } from 'frappe-ui'
import { RouterLink } from 'vue-router'
import StudentPageHeader from '@/components/Student/StudentPageHeader.vue'
import { sessionStore } from '@/stores/session'

type AssessmentItem = {
	key: string
	title: string
	type: string
	status: string
	meta?: string
	route?: any
	href?: string
}

const user = inject<any>('$user')
const dayjs = inject<any>('$dayjs')
const { brand } = sessionStore()
const batchAssessments = ref<AssessmentItem[]>([])

const myGroups = createResource({
	url: 'lms.lms.api.get_my_batches',
	auto: true,
})
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
const quizSubmissions = createListResource({
	doctype: 'LMS Quiz Submission',
	filters: { member: user.data?.name },
	fields: ['name', 'quiz', 'quiz_title', 'percentage', 'course'],
	orderBy: 'modified desc',
	pageLength: 100,
	auto: true,
})
const assignmentSubmissions = createListResource({
	doctype: 'LMS Assignment Submission',
	filters: { member: user.data?.name },
	fields: ['name', 'assignment', 'assignment_title', 'status', 'course'],
	orderBy: 'modified desc',
	pageLength: 100,
	auto: true,
})

watch(
	() => myGroups.data,
	async (groups) => {
		if (!groups) return
		const enrolledGroups = groups.filter((group: any) =>
			group.students?.includes(user.data?.name)
		)
		const assessmentResults = await Promise.allSettled(
			enrolledGroups.map(async (group: any) => {
				const assessments = await call('lms.lms.utils.get_assessments', {
					batch: group.name,
				})
				return (assessments || [])
					.filter(
						(assessment: any) =>
							assessment.assessment_type !== 'LMS Programming Exercise'
					)
					.map((assessment: any) => ({
						key: `group-${group.name}-${assessment.name}`,
						title: assessment.title,
						type:
							assessment.assessment_type === 'LMS Quiz'
								? __('Quiz')
								: __('Assignment'),
						status: assessment.completed
							? assessment.status || __('Completed')
							: __('Pending'),
						meta: `${__('Group')}: ${group.title}`,
						route:
							assessment.assessment_type === 'LMS Quiz'
								? {
										name: 'QuizPage',
										params: { quizID: assessment.assessment_name },
								  }
								: {
										name: 'AssignmentSubmission',
										params: {
											assignmentID: assessment.assessment_name,
											submissionName:
												assessment.submission?.name || 'new-submission',
										},
								  },
						completed: Boolean(assessment.completed),
					}))
			})
		)
		batchAssessments.value = assessmentResults.flatMap((result) =>
			result.status === 'fulfilled' ? result.value : []
		)
	},
	{ immediate: true }
)

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
const quizItems = computed(() =>
	(quizSubmissions.data || []).map((quiz: any) => ({
		key: `quiz-${quiz.name}`,
		title: quiz.quiz_title || quiz.quiz,
		type: __('Quiz'),
		status: `${Number(quiz.percentage || 0)}%`,
		meta: quiz.course || '',
		route: { name: 'QuizPage', params: { quizID: quiz.quiz } },
		completed: true,
	}))
)
const assignmentItems = computed(() =>
	(assignmentSubmissions.data || []).map((assignment: any) => ({
		key: `assignment-${assignment.name}`,
		title: assignment.assignment_title || assignment.assignment,
		type: __('Assignment'),
		status: __(assignment.status || 'Submitted'),
		meta: assignment.course || '',
		route: {
			name: 'AssignmentSubmission',
			params: {
				assignmentID: assignment.assignment,
				submissionName: assignment.name,
			},
		},
		completed: true,
	}))
)
const allItems = computed(() => [
	...certificateItems.value,
	...batchAssessments.value,
	...quizItems.value,
	...assignmentItems.value,
])
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
