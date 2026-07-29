import { beforeAll, describe, expect, it } from 'vitest'
import {
	egyptianArabicErrorHint,
	formatRuntimeError,
} from '@/utils/codingLab/errorHelp'
import {
	clampLessonShare,
	lessonShareFromPointer,
	resizeLessonShare,
} from '@/utils/codingLab/workspace'
import {
	buildSandboxDocument,
	isCodingLabMessage,
} from '@/utils/codingLab/runtime'

beforeAll(() => {
	;(globalThis as any).__ = (text: string) => text
})

describe('Coding Lab runtime error help', () => {
	it('maps common errors deterministically and keeps the original first', () => {
		const formatted = formatRuntimeError(
			'NameError: name answer is not defined',
			true
		)
		expect(formatted.original).toContain('NameError')
		expect(formatted.hint).toBe(
			egyptianArabicErrorHint('NameError: name answer is not defined')
		)
		expect(formatted.hint).toContain('متغير')
	})

	it('uses a neutral Arabic hint for unknown errors and no hint in LTR', () => {
		expect(egyptianArabicErrorHint('Something novel happened')).toContain(
			'مش كفاية'
		)
		expect(formatRuntimeError('TypeError: bad value', false).hint).toBe('')
	})
})

describe('Coding Lab workspace sizing', () => {
	it('clamps the lesson side to 35–65 percent', () => {
		expect(clampLessonShare(10)).toBe(35)
		expect(clampLessonShare(80)).toBe(65)
		expect(clampLessonShare(52)).toBe(52)
	})

	it('derives pointer and keyboard sizes with RTL support', () => {
		expect(lessonShareFromPointer(600, 100, 1000)).toBe(50)
		expect(lessonShareFromPointer(450, 100, 1000, true)).toBe(65)
		expect(resizeLessonShare(64, 'ArrowRight', 4)).toBe(65)
		expect(resizeLessonShare(36, 'ArrowLeft', 4)).toBe(35)
	})
})

describe('Coding Lab Web sandbox messaging', () => {
	it('accepts messages only from the active sandbox and matching run channel', () => {
		const frameWindow = {}
		const valid = {
			source: frameWindow,
			data: {
				source: 'lms-coding-lab',
				channel: 'run-1',
				type: 'console',
			},
		}
		expect(isCodingLabMessage(valid, frameWindow, 'run-1')).toBe(true)
		expect(
			isCodingLabMessage({ ...valid, source: {} }, frameWindow, 'run-1')
		).toBe(false)
		expect(isCodingLabMessage(valid, frameWindow, 'run-2')).toBe(false)
	})

	it('places learner code and local tests in one sandbox execution', () => {
		const document = buildSandboxDocument({
			javascript: 'const answer = 42',
			tests: "test('answer', () => assertEqual(answer, 42))",
			runTests: true,
			channel: 'run-1',
		})
		expect(document).toContain('const answer = 42')
		expect(document).toContain("test('answer'")
		expect(document).toContain("source: 'lms-coding-lab'")
	})
})
