<template>
	<div class="space-y-8">
		<section
			v-if="continueCourse"
			class="ft-panel overflow-hidden rounded-2xl lg:grid lg:grid-cols-[minmax(0,1fr),18rem]"
		>
			<div class="p-5 sm:p-7">
				<div class="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ft-muted)]">
					<span class="size-2 rounded-full bg-[#9cff45]" />
					{{ __('Continue where you left off') }}
				</div>
				<h2 class="text-2xl font-semibold sm:text-3xl">
					{{ continueCourse.title }}
				</h2>
				<p class="mt-2 line-clamp-2 max-w-2xl text-sm leading-6 text-[var(--ft-muted)]">
					{{ continueCourse.short_introduction }}
				</p>
				<div class="mt-6 max-w-xl">
					<div class="mb-2 flex justify-between text-xs text-[var(--ft-muted)]">
						<span>{{ __('Course progress') }}</span>
						<span>{{ continueProgress }}%</span>
					</div>
					<div class="h-2 overflow-hidden rounded-full bg-black/10">
						<div
							class="h-full rounded-full bg-[#9cff45]"
							:style="{ width: `${continueProgress}%` }"
						/>
					</div>
				</div>
				<router-link
					:to="continueRoute"
					class="ft-primary-button mt-6 inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9cff45] focus-visible:ring-offset-2"
				>
					<span class="lucide-play size-4" />
					{{ __('Continue learning') }}
				</router-link>
			</div>
			<div
				class="min-h-44 bg-[#0b2b36] bg-cover bg-center"
				:style="
					continueCourse.image
						? { backgroundImage: `url('${encodeURI(continueCourse.image)}')` }
						: {}
				"
			>
				<div
					v-if="!continueCourse.image"
					class="grid h-full min-h-44 place-items-center bg-[linear-gradient(135deg,rgba(156,255,69,.12),transparent)] p-8 text-center text-xl font-semibold text-[#9cff45]"
				>
					{{ continueCourse.title }}
				</div>
			</div>
		</section>
		<section
			v-else
			class="ft-panel rounded-2xl border-dashed p-7 text-center"
		>
			<div class="mx-auto grid size-11 place-items-center rounded-xl bg-[#9cff45]/10 text-[#5d9b2c]">
				<span class="lucide-book-open size-5" />
			</div>
			<h2 class="mt-4 text-xl font-semibold">{{ __('Ready when you are') }}</h2>
			<p class="mt-2 text-sm text-[var(--ft-muted)]">
				{{ __('Your next in-progress course will appear here once learning activity is recorded.') }}
			</p>
			<router-link
				:to="{ name: 'Courses' }"
				class="mt-4 inline-flex text-sm font-semibold text-[var(--ft-ink)] underline decoration-[#9cff45] decoration-2 underline-offset-4"
			>
				{{ __('Open Learning') }}
			</router-link>
		</section>

		<div class="grid gap-6 xl:grid-cols-[minmax(0,1.5fr),minmax(18rem,1fr)]">
			<section class="ft-panel rounded-2xl p-5 sm:p-6">
				<div class="mb-5 flex items-center justify-between gap-4">
					<div>
						<p class="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ft-muted)]">
							{{ __('Schedule') }}
						</p>
						<h2 class="mt-1 text-xl font-semibold">{{ __('Upcoming') }}</h2>
					</div>
					<router-link
						:to="{ name: 'StudentAssessments' }"
						class="text-xs font-semibold text-[var(--ft-muted)] hover:text-[var(--ft-ink)]"
					>
						{{ __('Assessments') }}
					</router-link>
				</div>

				<div v-if="myLiveClasses.data?.length" class="space-y-3">
					<article
						v-for="cls in myLiveClasses.data"
						:key="cls.name"
						class="rounded-xl border border-[var(--ft-border)] p-4"
					>
						<div class="flex flex-wrap items-start justify-between gap-3">
							<div>
								<p class="font-semibold">{{ cls.title }}</p>
								<p class="mt-1 text-xs text-[var(--ft-muted)]">
									{{ __('Group live class') }}
								</p>
							</div>
							<div class="text-end text-xs text-[var(--ft-muted)]">
								<div>{{ dayjs(cls.date).format('DD MMM YYYY') }}</div>
								<div>{{ formatTime(cls.time) }}</div>
							</div>
						</div>
						<a
							v-if="canAccessClass(cls) && cls.join_url"
							:href="cls.join_url"
							target="_blank"
							rel="noopener noreferrer"
							class="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold underline decoration-[#9cff45] decoration-2 underline-offset-4"
						>
							<span class="lucide-video size-3.5" />
							{{ __('Join') }}
						</a>
					</article>
				</div>
				<div v-else class="rounded-xl border border-dashed border-[var(--ft-border)] p-5 text-sm text-[var(--ft-muted)]">
					{{ __('No upcoming live classes are currently available.') }}
				</div>

				<div class="mt-5 border-t border-[var(--ft-border)] pt-5">
					<UpcomingEvaluations :forHome="true" />
				</div>
			</section>

			<section class="ft-panel rounded-2xl p-5 sm:p-6">
				<p class="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ft-muted)]">
					{{ __('Snapshot') }}
				</p>
				<h2 class="mt-1 text-xl font-semibold">{{ __('Progress summary') }}</h2>
				<div v-if="progressSummary.enrolled" class="mt-5 grid grid-cols-3 gap-2">
					<div class="rounded-xl border border-[var(--ft-border)] p-3 text-center">
						<div class="text-2xl font-semibold">{{ progressSummary.enrolled }}</div>
						<div class="mt-1 text-[11px] text-[var(--ft-muted)]">{{ __('Enrolled') }}</div>
					</div>
					<div class="rounded-xl border border-[var(--ft-border)] p-3 text-center">
						<div class="text-2xl font-semibold">{{ progressSummary.average }}%</div>
						<div class="mt-1 text-[11px] text-[var(--ft-muted)]">{{ __('Average') }}</div>
					</div>
					<div class="rounded-xl border border-[var(--ft-border)] p-3 text-center">
						<div class="text-2xl font-semibold">{{ progressSummary.completed }}</div>
						<div class="mt-1 text-[11px] text-[var(--ft-muted)]">{{ __('Done') }}</div>
					</div>
				</div>
				<div v-else class="mt-5 rounded-xl border border-dashed border-[var(--ft-border)] p-5 text-sm text-[var(--ft-muted)]">
					{{ __('Progress appears after you enroll in a course.') }}
				</div>
			</section>
		</div>

		<section class="ft-panel rounded-2xl p-5 sm:p-6">
			<div class="mb-5">
				<p class="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ft-muted)]">
					{{ __('Your groups') }}
				</p>
				<h2 class="mt-1 text-xl font-semibold">{{ __('Latest announcements') }}</h2>
			</div>
			<div v-if="announcements.length" class="divide-y divide-[var(--ft-border)]">
				<article v-for="announcement in announcements" :key="announcement.key" class="py-4 first:pt-0 last:pb-0">
					<div class="flex flex-wrap items-center justify-between gap-2">
						<h3 class="font-semibold">{{ announcement.subject || __('Announcement') }}</h3>
						<span class="text-xs text-[var(--ft-muted)]">
							{{ announcement.groupTitle }} ·
							{{ dayjs(announcement.communication_date).fromNow() }}
						</span>
					</div>
					<div
						class="mt-2 line-clamp-2 text-sm leading-6 text-[var(--ft-muted)]"
						v-html="sanitizeHTML(announcement.content || '')"
					/>
				</article>
			</div>
			<div v-else class="rounded-xl border border-dashed border-[var(--ft-border)] p-5 text-sm text-[var(--ft-muted)]">
				{{ announcementEmpty }}
			</div>
		</section>
	</div>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { call, createResource } from 'frappe-ui'
import { formatTime, sanitizeHTML } from '@/utils'
import UpcomingEvaluations from '@/components/UpcomingEvaluations.vue'
import {
	selectContinueCourse,
	type StudentCourse,
} from '@/composables/useStudentExperience'

const dayjs = inject<any>('$dayjs')
const user = inject<any>('$user')
const props = defineProps<{ myLiveClasses: any }>()
const announcements = ref<any[]>([])
const announcementsLoading = ref(true)

const myCourses = createResource({
	url: 'lms.lms.api.get_my_courses',
	auto: true,
})
const myGroups = createResource({
	url: 'lms.lms.api.get_my_batches',
	auto: true,
})
const continueDetails = createResource({
	url: 'lms.lms.utils.get_course_details',
	auto: false,
})

const continueCourse = computed(() =>
	selectContinueCourse((myCourses.data || []) as StudentCourse[])
)
const continueProgress = computed(() =>
	Math.round(Number(continueCourse.value?.membership?.progress || 0))
)
const continueRoute = computed(() => {
	const index = continueDetails.data?.current_lesson
	if (index && continueCourse.value) {
		const [chapterNumber, lessonNumber] = String(index).split('-')
		return {
			name: 'Lesson',
			params: {
				courseName: continueCourse.value.name,
				chapterNumber,
				lessonNumber,
			},
		}
	}
	return {
		name: 'CourseDetail',
		params: { courseName: continueCourse.value?.name },
	}
})
const progressSummary = computed(() => {
	const enrolled = (myCourses.data || []).filter((course: any) => course.membership)
	const completed = enrolled.filter(
		(course: any) => Number(course.membership.progress || 0) >= 100
	).length
	const average = enrolled.length
		? Math.round(
				enrolled.reduce(
					(total: number, course: any) =>
						total + Number(course.membership.progress || 0),
					0
				) / enrolled.length
		  )
		: 0
	return { enrolled: enrolled.length, completed, average }
})
const announcementEmpty = computed(() =>
	announcementsLoading.value
		? __('Loading announcements…')
		: __('No announcements are available from your enrolled groups.')
)

watch(
	continueCourse,
	(course) => {
		if (course) continueDetails.reload({ course: course.name })
	},
	{ immediate: true }
)

watch(
	() => myGroups.data,
	async (groups) => {
		if (!groups) return
		const enrolledGroups = groups.filter((group: any) =>
			group.students?.includes(user.data?.name)
		)
		if (!enrolledGroups.length) {
			announcements.value = []
			announcementsLoading.value = false
			return
		}
		const results = await Promise.allSettled(
			enrolledGroups.map(async (group: any) => {
				const rows = await call('lms.lms.api.get_announcements', {
					batch: group.name,
				})
				return (rows || []).map((row: any, index: number) => ({
					...row,
					groupTitle: group.title,
					key: `${group.name}-${row.communication_date}-${index}`,
				}))
			})
		)
		announcements.value = results
			.flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
			.sort(
				(a, b) =>
					new Date(b.communication_date).getTime() -
					new Date(a.communication_date).getTime()
			)
			.slice(0, 3)
		announcementsLoading.value = false
	},
	{ immediate: true }
)

const getClassEnd = (cls: { date: string; time: string; duration: number }) => {
	const classStart = new Date(`${cls.date}T${cls.time}`)
	return new Date(classStart.getTime() + cls.duration * 60000)
}
const canAccessClass = (cls: {
	date: string
	time: string
	duration: number
}) =>
	cls.date === dayjs().format('YYYY-MM-DD') && new Date() <= getClassEnd(cls)
</script>
