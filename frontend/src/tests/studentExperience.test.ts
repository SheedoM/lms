import { describe, expect, it } from 'vitest'
import {
	categorizeStudentCourses,
	getStudentNavigationMode,
	getStudentRouteDecision,
	isPureStudentData,
	selectContinueCourse,
	STUDENT_NAV_ITEMS,
} from '@/utils/studentExperience'
import { notificationRoute } from '@/utils/notifications'

const student = {
	name: 'student@example.com',
	is_student: true,
	is_instructor: false,
	is_moderator: false,
	is_evaluator: false,
	is_system_manager: false,
	roles: ['LMS Student'],
}

describe('pure-student role boundary', () => {
	it('accepts only a student without any privileged LMS or system role', () => {
		expect(isPureStudentData(student)).toBe(true)
		expect(isPureStudentData({ ...student, is_instructor: true })).toBe(false)
		expect(isPureStudentData({ ...student, is_moderator: true })).toBe(false)
		expect(isPureStudentData({ ...student, is_evaluator: true })).toBe(false)
		expect(isPureStudentData({ ...student, is_system_manager: true })).toBe(
			false
		)
		expect(
			isPureStudentData({ ...student, roles: ['LMS Student', 'System Manager'] })
		).toBe(false)
		expect(isPureStudentData(null)).toBe(false)
	})

	it('defines exactly the five requested destinations in order', () => {
		expect(STUDENT_NAV_ITEMS.map(({ label, labelAr, to }) => ({ label, labelAr, to })))
			.toEqual([
				{ label: 'Home', labelAr: 'الرئيسية', to: 'Home' },
				{ label: 'Learning', labelAr: 'التعلّم', to: 'Courses' },
				{
					label: 'Assessments',
					labelAr: 'التقييمات',
					to: 'StudentAssessments',
				},
				{
					label: 'Notifications',
					labelAr: 'الإشعارات',
					to: 'StudentNotifications',
				},
				{ label: 'Account', labelAr: 'حسابي', to: 'StudentAccount' },
			])
	})
})

describe('student responsive navigation', () => {
	it('uses an expanded 224px navigation mode on large desktops', () => {
		expect(
			getStudentNavigationMode({ width: 1440, height: 900 })
		).toBe('expanded')
	})

	it('defaults laptops to a rail and persists an explicit pin decision', () => {
		expect(
			getStudentNavigationMode({ width: 1200, height: 800 })
		).toBe('rail')
		expect(
			getStudentNavigationMode({
				width: 1200,
				height: 800,
				temporaryExpanded: true,
			})
		).toBe('overlay')
		expect(
			getStudentNavigationMode({
				width: 1200,
				height: 800,
				preference: 'pinned',
			})
		).toBe('pinned')
	})

	it('uses a rail only on practical landscape tablets and bottom nav otherwise', () => {
		expect(
			getStudentNavigationMode({ width: 900, height: 700 })
		).toBe('rail')
		expect(
			getStudentNavigationMode({ width: 800, height: 1000 })
		).toBe('bottom')
		expect(
			getStudentNavigationMode({ width: 639, height: 900 })
		).toBe('bottom')
	})

	it('lets lesson/editor focus mode collapse persistent navigation', () => {
		expect(
			getStudentNavigationMode({
				width: 1600,
				height: 900,
				focusMode: true,
			})
		).toBe('rail')
	})
})

describe('student route compatibility', () => {
	it('redirects only a pure student /batches bookmark to Home', () => {
		expect(
			getStudentRouteDecision({
				routeName: 'Batches',
				path: '/batches',
				user: student,
			})
		).toBe('home')
		expect(
			getStudentRouteDecision({
				routeName: 'Batches',
				path: '/batches',
				user: { ...student, is_instructor: true },
			})
		).toBe('allow')
	})

	it('keeps direct permitted group details additive', () => {
		expect(
			getStudentRouteDecision({
				routeName: 'BatchDetail',
				path: '/batches/group-1',
				user: student,
			})
		).toBe('allow')
	})

	it('protects student-only destinations from guests and privileged users', () => {
		expect(
			getStudentRouteDecision({
				routeName: 'StudentAccount',
				path: '/account',
				user: null,
			})
		).toBe('courses')
		expect(
			getStudentRouteDecision({
				routeName: 'StudentAssessments',
				path: '/assessments',
				user: { ...student, is_moderator: true },
			})
		).toBe('home')
	})
})

describe('real course state transformations', () => {
	const courses = [
		{ name: 'new', membership: { progress: 0, current_lesson: null } },
		{ name: 'resume', membership: { progress: 42, current_lesson: 'LESSON-2' } },
		{ name: 'done', membership: { progress: 100, current_lesson: 'LESSON-9' } },
		{ name: 'catalog' },
	]

	it('partitions real membership/progress fields without inventing states', () => {
		const result = categorizeStudentCourses(courses)
		expect(result.learningNow.map((course) => course.name)).toEqual(['new'])
		expect(result.continueLearning.map((course) => course.name)).toEqual([
			'resume',
		])
		expect(result.completed.map((course) => course.name)).toEqual(['done'])
		expect(result.available.map((course) => course.name)).toEqual(['catalog'])
	})

	it('selects one genuine in-progress course for Home, never catalog data', () => {
		expect(selectContinueCourse(courses)?.name).toBe('resume')
		expect(selectContinueCourse([{ name: 'catalog' }])).toBeNull()
	})
})

describe('notification navigation reuse', () => {
	it('maps supported existing notification links and leaves unknown links alone', () => {
		expect(notificationRoute({ link: '/lms/courses/course-1' })).toEqual({
			name: 'CourseDetail',
			params: { courseName: 'course-1' },
		})
		expect(notificationRoute({ link: '/lms/batches/group-1' })).toEqual({
			name: 'BatchDetail',
			params: { batchName: 'group-1' },
		})
		expect(notificationRoute({ link: '/desk/form/User/test' })).toBeNull()
	})
})
