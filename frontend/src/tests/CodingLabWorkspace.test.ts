import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import CodingLabWorkspace from '@/components/CodingLabWorkspace.vue'
import { normalizeCodingLab } from '@/utils/codingLab/schema'

const context = {
	user: 'student@example.com',
	course: 'free-coding-lab',
	chapter: 'workspace',
	lesson: 'python',
	authorPreview: true,
}

function createLab() {
	return normalizeCodingLab({
		block_id: 'free-python',
		title: 'Python Workspace',
		lab_kind: 'python',
		starter_files: { python: '' },
	})
}

describe('standalone Coding Lab workspace', () => {
	beforeEach(() => localStorage.clear())

	it('uses the compact console default and an accessible arrow toggle', async () => {
		const lab = createLab()
		const wrapper = mount(CodingLabWorkspace, {
			props: {
				labs: [lab],
				activeLab: lab,
				context,
				showHeader: false,
				showClose: false,
				initialConsoleHeight: 120,
			},
			global: {
				stubs: {
					CodingLabEditor: {
						template: '<div class="coding-lab-ace-editor" />',
					},
					ChevronDown: true,
					ChevronUp: true,
				},
			},
		})

		expect(wrapper.find('.coding-lab-workspace-header').exists()).toBe(false)
		expect(wrapper.get('.coding-lab-learner-console').attributes('style')).toContain(
			'height: 120px'
		)

		const hide = wrapper.get('button[aria-label="Hide Terminal"]')
		expect(hide.attributes('aria-expanded')).toBe('true')
		await hide.trigger('click')

		const show = wrapper.get('button[aria-label="Show Terminal"]')
		expect(show.attributes('aria-expanded')).toBe('false')
		await show.trigger('click')
		expect(wrapper.get('button[aria-label="Hide Terminal"]')).toBeTruthy()

		wrapper.unmount()
	})
})
