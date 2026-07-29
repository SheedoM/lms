import { beforeAll, describe, expect, it } from 'vitest'
import { CodingLab } from '@/utils/codingLab/CodingLab'

beforeAll(() => {
	;(globalThis as any).__ = (text: string) => text
})

describe('Coding Lab committed versus draft state', () => {
	it('ordinary EditorJS save keeps the last committed Save IDE snapshot', () => {
		const tool = new CodingLab({
			data: {
				block_id: 'block-1',
				lab_kind: 'python',
				starter_files: { python: '# committed' },
			},
			readOnly: false,
			block: { id: 'block-1', dispatchChange() {} },
		})
		tool.draft.starter_files.python = '# unsaved keystrokes'
		expect(tool.save().starter_files.python).toBe('# committed')
		tool.destroy()
	})

	it('Save IDE promotes the draft, dispatches once, and awaits persistence', async () => {
		let changes = 0
		let persisted = false
		const tool = new CodingLab({
			data: {
				block_id: 'block-1',
				lab_kind: 'python',
				starter_files: { python: '# committed' },
			},
			readOnly: false,
			block: {
				id: 'block-1',
				dispatchChange() {
					changes += 1
				},
			},
		})
		tool.syncDraftFromFields = () => {
			tool.draft.starter_files.python = '# promoted'
		}
		tool.wrapper.addEventListener('lms:coding-lab-save-request', (event: any) => {
			event.detail.handled = true
			event.detail.commit()
			setTimeout(() => {
				persisted = true
				event.detail.resolve()
			}, 0)
		})

		await tool.saveIde()
		expect(changes).toBe(1)
		expect(persisted).toBe(true)
		expect(tool.save().starter_files.python).toBe('# promoted')
		tool.destroy()
	})

	it('restores the previous committed snapshot when lesson persistence fails', async () => {
		const tool = new CodingLab({
			data: {
				block_id: 'block-1',
				lab_kind: 'python',
				starter_files: { python: '# committed' },
			},
			readOnly: false,
			block: { id: 'block-1', dispatchChange() {} },
		})
		tool.syncDraftFromFields = () => {
			tool.draft.starter_files.python = '# failed promotion'
		}
		tool.wrapper.addEventListener('lms:coding-lab-save-request', (event: any) => {
			event.detail.handled = true
			event.detail.commit()
			event.detail.reject(new Error('server rejected save'))
		})

		await tool.saveIde()
		expect(tool.save().starter_files.python).toBe('# committed')
		tool.destroy()
	})
})
