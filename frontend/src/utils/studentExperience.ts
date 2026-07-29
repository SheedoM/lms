export const STUDENT_ONLY_ROUTE_NAMES = [
	'StudentAssessments',
	'StudentNotifications',
	'StudentAccount',
] as const

export const STUDENT_NAV_ITEMS = [
	{
		label: 'Home',
		labelAr: 'الرئيسية',
		icon: 'House',
		to: 'Home',
		activeFor: ['Home'],
	},
	{
		label: 'Learning',
		labelAr: 'التعلّم',
		icon: 'BookOpen',
		to: 'Courses',
		activeFor: ['Courses', 'CourseDetail', 'Lesson', 'SCORMChapter'],
	},
	{
		label: 'Assessments',
		labelAr: 'التقييمات',
		icon: 'ClipboardCheck',
		to: 'StudentAssessments',
		activeFor: [
			'StudentAssessments',
			'QuizPage',
			'QuizSubmission',
			'AssignmentSubmission',
		],
	},
	{
		label: 'Notifications',
		labelAr: 'الإشعارات',
		icon: 'Bell',
		to: 'StudentNotifications',
		activeFor: ['StudentNotifications'],
	},
	{
		label: 'Account',
		labelAr: 'حسابي',
		icon: 'CircleUserRound',
		to: 'StudentAccount',
		activeFor: ['StudentAccount'],
	},
] as const

const PRIVILEGED_FLAGS = [
	'is_instructor',
	'is_moderator',
	'is_evaluator',
	'is_system_manager',
] as const

const PRIVILEGED_ROLES = [
	'Course Creator',
	'Moderator',
	'Batch Evaluator',
	'System Manager',
]

export function isPureStudentData(
	data: Record<string, any> | null | undefined
): boolean {
	if (!data?.is_student) return false
	if (PRIVILEGED_FLAGS.some((flag) => Boolean(data[flag]))) return false
	const roles = Array.isArray(data.roles) ? data.roles : []
	return !roles.some((role) => PRIVILEGED_ROLES.includes(role))
}

export type StudentNavigationMode =
	| 'expanded'
	| 'rail'
	| 'overlay'
	| 'pinned'
	| 'bottom'

export type StudentSidebarPreference = 'compact' | 'pinned'

export function getStudentNavigationMode({
	width,
	height,
	preference = 'compact',
	temporaryExpanded = false,
	focusMode = false,
}: {
	width: number
	height: number
	preference?: StudentSidebarPreference
	temporaryExpanded?: boolean
	focusMode?: boolean
}): StudentNavigationMode {
	if (width < 640) return 'bottom'
	if (focusMode) return 'rail'

	if (width >= 1440) return 'expanded'
	if (width >= 1024) {
		if (preference === 'pinned') return 'pinned'
		return temporaryExpanded ? 'overlay' : 'rail'
	}

	const landscapeRail = width >= 800 && width > height
	if (!landscapeRail) return 'bottom'
	return temporaryExpanded ? 'overlay' : 'rail'
}

export type StudentRouteDecision = 'allow' | 'home' | 'courses'

export function getStudentRouteDecision({
	routeName,
	path,
	user,
}: {
	routeName?: string | symbol | null
	path: string
	user: Record<string, any> | null | undefined
}): StudentRouteDecision {
	const pureStudent = isPureStudentData(user)
	if (pureStudent && path.replace(/\/+$/, '') === '/batches') return 'home'
	if (
		STUDENT_ONLY_ROUTE_NAMES.includes(
			routeName as (typeof STUDENT_ONLY_ROUTE_NAMES)[number]
		)
	) {
		if (pureStudent) return 'allow'
		return user ? 'home' : 'courses'
	}
	return 'allow'
}

export type StudentCourse = {
	name: string
	membership?: {
		progress?: number
		current_lesson?: string | null
	} | null
	[key: string]: any
}

export function categorizeStudentCourses(courses: StudentCourse[] = []) {
	const learningNow: StudentCourse[] = []
	const continueLearning: StudentCourse[] = []
	const completed: StudentCourse[] = []
	const available: StudentCourse[] = []

	for (const course of courses) {
		if (!course.membership) {
			available.push(course)
			continue
		}
		const progress = Number(course.membership.progress || 0)
		if (progress >= 100) completed.push(course)
		else if (progress > 0 || course.membership.current_lesson)
			continueLearning.push(course)
		else learningNow.push(course)
	}

	return { learningNow, continueLearning, completed, available }
}

export function selectContinueCourse(courses: StudentCourse[] = []) {
	return (
		courses.find((course) => {
			const progress = Number(course.membership?.progress || 0)
			return (
				Boolean(course.membership) &&
				progress < 100 &&
				(progress > 0 || Boolean(course.membership?.current_lesson))
			)
		}) || null
	)
}
