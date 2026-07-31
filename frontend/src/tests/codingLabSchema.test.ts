import { beforeAll, describe, expect, it } from 'vitest'
import {
	CODING_LAB_SCHEMA_VERSION,
	extractCodingLabs,
	normalizeCodingLab,
	serializeCodingLab,
} from '@/utils/codingLab/schema'

beforeAll(() => {
	;(globalThis as any).__ = (text: string) => text
})

describe('Coding Lab block normalization', () => {
	it('normalizes the old javascript inline snapshot schema', () => {
		const lab = normalizeCodingLab(
			{
				lab_type: 'javascript',
				title: 'JS variables',
				starter_code: { js: 'const answer = 42' },
				test_code: { web: "test('answer', () => assertEqual(answer, 42))" },
			},
			'legacy-block'
		)
		expect(lab.block_id).toBe('legacy-block')
		expect(lab.lab_kind).toBe('web')
		expect(lab.enabled_web_files).toEqual(['javascript'])
		expect(lab.starter_files.javascript).toContain('answer')
		expect(lab).not.toHaveProperty('test_code')
		expect(lab.schema_version).toBe(CODING_LAB_SCHEMA_VERSION)
	})

	it('normalizes full_web and string Python starter_code variants', () => {
		expect(
			normalizeCodingLab({
				lab_type: 'full_web',
				starter_code: { html: '<h1>Hello</h1>' },
			}).enabled_web_files
		).toEqual(['html', 'css', 'javascript'])
		expect(
			normalizeCodingLab({
				lab_type: 'python',
				starter_code: 'print("hello")',
			}).starter_files.python
		).toBe('print("hello")')
	})

	it('extracts both canonical and underscored block types', () => {
		const labs = extractCodingLabs({
			blocks: [
				{
					id: 'one',
					type: 'codingLab',
					data: { lab_kind: 'python' },
				},
				{
					id: 'two',
					type: 'coding_lab',
					data: { lab_type: 'full_web' },
				},
				{ type: 'paragraph', data: { text: 'not a lab' } },
			],
		})
		expect(labs.map((lab) => lab.block_id)).toEqual(['one', 'two'])
	})

	it('changes the starter revision only when committed mode or files change', () => {
		const original = normalizeCodingLab({
			block_id: 'lab',
			lab_kind: 'python',
			starter_files: { python: 'print("one")' },
			title: 'First title',
		})
		const renamed = normalizeCodingLab({
			...original,
			title: 'Renamed',
		})
		const changed = normalizeCodingLab({
			...original,
			starter_files: { ...original.starter_files, python: 'print("two")' },
		})

		expect(renamed.starter_revision).toBe(original.starter_revision)
		expect(changed.starter_revision).not.toBe(original.starter_revision)
	})

	it('strips legacy assessment fields when an instructor saves', () => {
		const saved = serializeCodingLab({
			lab_type: 'javascript',
			starter_code: { js: 'console.log("practice")' },
			test_code: 'legacy tests',
			autograding: true,
			attempts: [{ score: 100 }],
		})

		expect(saved).not.toHaveProperty('test_code')
		expect(saved).not.toHaveProperty('autograding')
		expect(saved).not.toHaveProperty('attempts')
		expect(saved.starter_revision).toMatch(/^starter-[0-9a-f]{8}$/)
	})
})
