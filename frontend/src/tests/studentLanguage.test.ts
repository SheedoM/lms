import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('frappe-ui', () => ({ createResource: vi.fn() }))
import {
	applyStudentLanguage,
	initializeTranslations,
} from '@/translation'

describe('Frappe-managed student language', () => {
	beforeEach(() => {
		localStorage.clear()
		vi.restoreAllMocks()
		window.lang = 'en'
		document.documentElement.lang = 'en'
		document.documentElement.dir = 'ltr'
	})

	it('applies the active Frappe language without creating a browser preference', async () => {
		window.lang = 'ar'
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ message: { 'Learning system': 'نظام التعلم' } }),
			})
		)

		await expect(initializeTranslations()).resolves.toBe('ar')

		expect(fetch).toHaveBeenCalledWith(
			'/api/method/lms.lms.api.get_translations?language=ar',
			{ credentials: 'same-origin' }
		)
		expect(document.documentElement.lang).toBe('ar')
		expect(document.documentElement.dir).toBe('rtl')
		expect(localStorage.length).toBe(0)
	})

	it('falls back to English when Frappe provides an unsupported language', () => {
		expect(applyStudentLanguage('fr')).toBe('en')
		expect(window.lang).toBe('en')
		expect(document.documentElement.lang).toBe('en')
		expect(document.documentElement.dir).toBe('ltr')
	})
})
