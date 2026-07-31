import { createResource } from 'frappe-ui'

export const STUDENT_LANGUAGE_KEY = 'ft:student-language'
export const STUDENT_LANGUAGES = new Set(['ar', 'en'])

export default function translationPlugin(app) {
	app.config.globalProperties.__ = translate
	window.__ = translate
	if (!window.translatedMessages) fetchTranslations(window.lang)
}

function translate(message) {
	let translatedMessages = window.translatedMessages || {}
	let translatedMessage = translatedMessages[message] || message

	const hasPlaceholders = /{\d+}/.test(message)
	if (!hasPlaceholders) {
		return translatedMessage
	}
	return {
		format: function (...args) {
			return translatedMessage.replace(
				/{(\d+)}/g,
				function (match, number) {
					return typeof args[number] != 'undefined'
						? args[number]
						: match
				}
			)
		},
	}
}

export function preferredStudentLanguage(storage = globalThis.localStorage) {
	try {
		const stored = storage?.getItem(STUDENT_LANGUAGE_KEY)
		if (STUDENT_LANGUAGES.has(stored)) return stored
	} catch {
		// Storage can be disabled by the browser.
	}
	return STUDENT_LANGUAGES.has(window.lang) ? window.lang : 'en'
}

export function applyStudentLanguage(language) {
	const next = STUDENT_LANGUAGES.has(language) ? language : 'en'
	window.lang = next
	document.documentElement.lang = next
	document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr'
	return next
}

export async function initializeTranslations() {
	const language = applyStudentLanguage(preferredStudentLanguage())
	try {
		const response = await fetch(
			`/api/method/lms.lms.api.get_translations?language=${encodeURIComponent(language)}`,
			{ credentials: 'same-origin' }
		)
		if (!response.ok) throw new Error(`Translation request failed: ${response.status}`)
		const payload = await response.json()
		window.translatedMessages = payload.message || {}
	} catch {
		window.translatedMessages = window.translatedMessages || {}
	}
	return language
}

export function selectStudentLanguage(language, storage = globalThis.localStorage) {
	if (!STUDENT_LANGUAGES.has(language)) return false
	try {
		storage?.setItem(STUDENT_LANGUAGE_KEY, language)
	} catch {
		return false
	}
	applyStudentLanguage(language)
	return true
}

function fetchTranslations(lang) {
	createResource({
		url: 'lms.lms.api.get_translations',
		params: { language: STUDENT_LANGUAGES.has(lang) ? lang : 'en' },
		cache: ['translations', lang],
		auto: true,
		transform: (data) => {
			window.translatedMessages = data
		},
	})
}
