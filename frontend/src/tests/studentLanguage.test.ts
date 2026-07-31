import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('frappe-ui', () => ({ createResource: vi.fn() }))
import {
	applyStudentLanguage,
	preferredStudentLanguage,
	selectStudentLanguage,
	STUDENT_LANGUAGE_KEY,
} from '@/translation'

describe('student browser language preference', () => {
	beforeEach(() => {
		localStorage.clear()
		window.lang = 'en'
		document.documentElement.lang = 'en'
		document.documentElement.dir = 'ltr'
	})

	it('persists Arabic in this browser and applies RTL document metadata', () => {
		expect(selectStudentLanguage('ar')).toBe(true)
		expect(localStorage.getItem(STUDENT_LANGUAGE_KEY)).toBe('ar')
		expect(preferredStudentLanguage()).toBe('ar')
		expect(document.documentElement.lang).toBe('ar')
		expect(document.documentElement.dir).toBe('rtl')
	})

	it('keeps unsupported languages out of browser storage', () => {
		expect(selectStudentLanguage('fr')).toBe(false)
		expect(localStorage.getItem(STUDENT_LANGUAGE_KEY)).toBeNull()
		expect(applyStudentLanguage('fr')).toBe('en')
		expect(document.documentElement.dir).toBe('ltr')
	})
})
