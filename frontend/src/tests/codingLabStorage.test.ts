import { describe, expect, it } from 'vitest'
import {
	codingLabStorageKey,
	loadLabState,
	resetLabState,
	saveLabState,
} from '@/utils/codingLab/storage'

const memoryStorage = () => {
	const values = new Map<string, string>()
	return {
		values,
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => values.set(key, value),
		removeItem: (key: string) => values.delete(key),
	}
}

describe('Coding Lab learner storage isolation', () => {
	it('scopes drafts by user, course, chapter, lesson and block', () => {
		const base = {
			user: 'student@example.com',
			course: 'course-a',
			chapter: '1',
			lesson: '2',
		}
		const first = codingLabStorageKey(base, 'block-a')
		expect(first).not.toBe(codingLabStorageKey(base, 'block-b'))
		expect(first).not.toBe(
			codingLabStorageKey({ ...base, user: 'another@example.com' }, 'block-a')
		)
		expect(first).not.toBe(
			codingLabStorageKey({ ...base, lesson: '3' }, 'block-a')
		)
	})

	it('author preview ignores storage and leaves a real learner draft untouched', () => {
		const storage = memoryStorage()
		const learner = {
			user: 'u',
			course: 'c',
			chapter: '1',
			lesson: '1',
			authorPreview: false,
		}
		saveLabState(storage as any, learner, 'lab', {
			files: { python: 'print("learner")' },
		})
		const key = codingLabStorageKey(learner, 'lab')
		const before = storage.values.get(key)
		const preview = { ...learner, authorPreview: true }
		expect(
			loadLabState(storage as any, preview, 'lab', {
				python: 'print("starter")',
			}).files.python
		).toBe('print("starter")')
		expect(
			saveLabState(storage as any, preview, 'lab', {
				files: { python: 'print("preview")' },
			})
		).toBe(false)
		expect(storage.values.get(key)).toBe(before)
	})

	it('Reset clears the learner draft and restores the committed starter files', () => {
		const storage = memoryStorage()
		const context = {
			user: 'u',
			course: 'c',
			chapter: '1',
			lesson: '1',
			authorPreview: false,
		}
		saveLabState(storage as any, context, 'lab', {
			files: { python: 'print("draft")' },
		})

		const reset = resetLabState(storage as any, context, 'lab', {
			python: '# committed starter\nprint("ready")',
		})

		expect(reset.files.python).toContain('# committed starter')
		expect(storage.values.has(codingLabStorageKey(context, 'lab'))).toBe(false)
	})
})
