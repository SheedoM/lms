import { describe, expect, it } from 'vitest'
import {
	clampLessonShare,
	lessonShareFromPointer,
	resizeLessonShare,
} from '@/utils/codingLab/workspace'
import {
	buildSandboxDocument,
	isCodingLabMessage,
	pyodideWorkerSource,
} from '@/utils/codingLab/runtime'

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

	it('places learner code in the sandbox without an assessment harness', () => {
		const document = buildSandboxDocument({
			javascript: 'const answer = 42',
			channel: 'run-1',
		})
		expect(document).toContain('const answer = 42')
		expect(document).not.toContain('assertEqual')
		expect(document).not.toContain('runTests')
		expect(document).toContain("source: 'lms-coding-lab'")
	})
})

describe('Coding Lab Python runtime', () => {
	it('supports repeated input requests and preserves original Python errors', () => {
		const worker = pyodideWorkerSource()
		expect(worker).toContain("type: 'input-request'")
		expect(worker).toContain('__lms_inputs_json')
		expect(worker).toContain('error.stack || error.message')
		expect(worker).not.toContain('Arabic')
	})
})
