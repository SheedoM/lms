export const MIN_LESSON_SHARE = 35
export const MAX_LESSON_SHARE = 65
export const DEFAULT_LESSON_SHARE = 50

export function clampLessonShare(value) {
	const number = Number(value)
	if (!Number.isFinite(number)) return DEFAULT_LESSON_SHARE
	return Math.min(MAX_LESSON_SHARE, Math.max(MIN_LESSON_SHARE, number))
}

export function lessonShareFromPointer(clientX, left, width, rtl = false) {
	if (!width) return DEFAULT_LESSON_SHARE
	const raw = ((clientX - left) / width) * 100
	return clampLessonShare(rtl ? 100 - raw : raw)
}

export function resizeLessonShare(current, key, step = 2) {
	const direction =
		key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0
	return clampLessonShare(Number(current) + direction * step)
}
