import { computed } from 'vue'
import { createResource } from 'frappe-ui'

export type StudentInlineAssessment = {
	key: string
	assessment_type: 'quiz' | 'assignment'
	assessment_name: string
	title: string
	status: string
	completed: boolean
	course?: string | null
	course_title?: string | null
	chapter_number?: number | null
	lesson_number?: number | null
	lesson?: string | null
	lesson_title?: string | null
	batch?: string | null
	batch_title?: string | null
	submission?: string | null
}

export function studentAssessmentRoute(item: StudentInlineAssessment) {
	if (item.course && item.chapter_number && item.lesson_number)
		return {
			name: 'Lesson',
			params: {
				courseName: item.course,
				chapterNumber: item.chapter_number,
				lessonNumber: item.lesson_number,
			},
		}
	if (item.assessment_type === 'quiz')
		return {
			name: 'QuizPage',
			params: { quizID: item.assessment_name },
		}
	return {
		name: 'AssignmentSubmission',
		params: {
			assignmentID: item.assessment_name,
			submissionName: item.submission || 'new-submission',
		},
	}
}

export function useStudentAssessments() {
	const resource = createResource({
		url: 'lms.lms.api.get_student_assessments',
		auto: true,
	})
	const items = computed(
		() => (resource.data || []) as StudentInlineAssessment[]
	)
	const todo = computed(() => items.value.filter((item) => !item.completed))
	const completed = computed(() =>
		items.value.filter((item) => item.completed)
	)

	return { resource, items, todo, completed }
}
