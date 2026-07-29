export const CODING_LAB_SCHEMA_VERSION = 3
export const CODING_LAB_BLOCK_TYPES = new Set(['codingLab', 'coding_lab'])
export const WEB_FILE_KEYS = ['html', 'css', 'javascript']
export const LAB_KINDS = ['web', 'python']

const emptyFiles = () => ({
	html: '',
	css: '',
	javascript: '',
	python: '',
})

const toString = (value) => (typeof value === 'string' ? value : '')

export function createBlockId() {
	return (
		globalThis.crypto?.randomUUID?.() ??
		`coding-lab-${Date.now()}-${Math.random().toString(36).slice(2)}`
	)
}

export function legacyLabKind(data = {}) {
	const type = data.lab_kind || data.lab_type || data.default_mode
	return type === 'python' ? 'python' : 'web'
}

export function normalizeCodingLab(data = {}, fallbackId) {
	const source = data && typeof data === 'object' ? data : {}
	const starter = source.starter_files || source.starter_code || {}
	const tests = source.test_code
	const labKind = legacyLabKind(source)
	const legacyType = source.lab_type || source.default_mode

	let enabledWebFiles = Array.isArray(source.enabled_web_files)
		? source.enabled_web_files.filter((file) => WEB_FILE_KEYS.includes(file))
		: []
	if (labKind === 'web' && !enabledWebFiles.length) {
		if (legacyType === 'javascript') enabledWebFiles = ['javascript']
		else if (legacyType === 'full_web' || legacyType === 'web')
			enabledWebFiles = [...WEB_FILE_KEYS]
		else {
			enabledWebFiles = WEB_FILE_KEYS.filter((file) => {
				const legacyKey = file === 'javascript' ? 'js' : file
				return Boolean(starter[file] || starter[legacyKey])
			})
			if (!enabledWebFiles.length) enabledWebFiles = [...WEB_FILE_KEYS]
		}
	}

	const starterFiles = emptyFiles()
	starterFiles.html = toString(starter.html)
	starterFiles.css = toString(starter.css)
	starterFiles.javascript = toString(starter.javascript || starter.js)
	starterFiles.python =
		toString(starter.python) ||
		(labKind === 'python' && typeof source.starter_code === 'string'
			? source.starter_code
			: '')

	let testCode = ''
	if (typeof tests === 'string') testCode = tests
	else if (tests && typeof tests === 'object') {
		testCode = toString(labKind === 'python' ? tests.python : tests.web || tests.js)
	}
	if (!testCode) testCode = toString(source.local_test_code)

	return {
		schema_version: CODING_LAB_SCHEMA_VERSION,
		block_id: toString(source.block_id || fallbackId) || createBlockId(),
		title: toString(source.title) || __('Untitled Coding Lab'),
		instructions: toString(source.instructions || source.task),
		lab_kind: labKind,
		enabled_web_files: labKind === 'web' ? enabledWebFiles : [],
		starter_files: starterFiles,
		test_code: testCode,
		ui: {
			default_file:
				toString(source.ui?.default_file) ||
				(labKind === 'python' ? 'python' : enabledWebFiles[0] || 'html'),
			console_open: source.ui?.console_open !== false,
			console_height: clampNumber(source.ui?.console_height, 100, 420, 180),
		},
	}
}

export function serializeCodingLab(data, fallbackId) {
	const normalized = normalizeCodingLab(data, fallbackId)
	return JSON.parse(JSON.stringify(normalized))
}

export function createCodingLab(kind, blockId) {
	return normalizeCodingLab(
		{
			block_id: blockId,
			lab_kind: kind,
			enabled_web_files: kind === 'web' ? [...WEB_FILE_KEYS] : [],
			starter_files: emptyFiles(),
		},
		blockId
	)
}

export function extractCodingLabs(content) {
	const document =
		typeof content === 'string'
			? safeParse(content)
			: content && typeof content === 'object'
				? content
				: {}
	if (!Array.isArray(document.blocks)) return []
	return document.blocks
		.filter(
			(block) =>
				block &&
				CODING_LAB_BLOCK_TYPES.has(block.type) &&
				block.data &&
				typeof block.data === 'object' &&
				(Object.keys(block.data).length > 0 || block.id)
		)
		.map((block) => normalizeCodingLab(block.data, block.id))
}

export function modeLabel(lab) {
	if (lab.lab_kind === 'python') return __('Python')
	const files = lab.enabled_web_files || []
	if (files.length === 1 && files[0] === 'javascript') return __('JavaScript')
	return __('Web')
}

export function instructionsSummary(value, maxLength = 180) {
	const parsed = new DOMParser().parseFromString(toString(value), 'text/html')
	const text = (parsed.body.textContent || '').replace(/\s+/g, ' ').trim()
	return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}

function safeParse(content) {
	try {
		return JSON.parse(content)
	} catch {
		return {}
	}
}

function clampNumber(value, min, max, fallback) {
	const number = Number(value)
	return Number.isFinite(number)
		? Math.min(max, Math.max(min, number))
		: fallback
}
