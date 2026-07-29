import { beforeAll, describe, expect, it } from 'vitest'
import {
	extractCodingLabs,
	normalizeCodingLab,
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
		expect(lab.test_code).toContain("test('answer'")
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
})
