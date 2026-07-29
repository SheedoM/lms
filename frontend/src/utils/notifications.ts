export function notificationRoute(log: { link?: string | null } | null) {
	if (!log?.link) return null
	const link = log.link.split('/')
	if (link[2] === 'courses' && link[3]) {
		return { name: 'CourseDetail', params: { courseName: link[3] } }
	}
	if (link.includes('batches')) {
		return { name: 'BatchDetail', params: { batchName: link.at(-1) } }
	}
	if (link.includes('assignment-submission') && link[3] && link[4]) {
		return {
			name: 'AssignmentSubmission',
			params: { submissionName: link[4], assignmentID: link[3] },
		}
	}
	return null
}
