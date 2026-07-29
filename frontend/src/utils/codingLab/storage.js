const STORAGE_PREFIX = 'lms:coding-lab:v3'

const safePart = (value) =>
	encodeURIComponent(String(value ?? '').trim() || 'anonymous')

export function codingLabStorageKey(context, blockId) {
	return [
		STORAGE_PREFIX,
		safePart(context.user),
		safePart(context.course),
		safePart(context.chapter),
		safePart(context.lesson),
		safePart(blockId),
	].join(':')
}

export function loadLabState(storage, context, blockId, starterFiles) {
	const fallback = {
		files: { ...starterFiles },
		consoleOpen: true,
		consoleHeight: 180,
	}
	if (context.authorPreview || !storage) return fallback
	try {
		const saved = JSON.parse(
			storage.getItem(codingLabStorageKey(context, blockId)) || 'null'
		)
		if (!saved || typeof saved !== 'object') return fallback
		return {
			...fallback,
			...saved,
			files: { ...starterFiles, ...(saved.files || {}) },
		}
	} catch {
		return fallback
	}
}

export function saveLabState(storage, context, blockId, state) {
	if (context.authorPreview || !storage) return false
	try {
		storage.setItem(
			codingLabStorageKey(context, blockId),
			JSON.stringify(state)
		)
		return true
	} catch {
		return false
	}
}

export function resetLabState(storage, context, blockId, starterFiles) {
	const state = {
		files: { ...starterFiles },
		consoleOpen: true,
		consoleHeight: 180,
	}
	if (!context.authorPreview && storage) {
		try {
			storage.removeItem(codingLabStorageKey(context, blockId))
		} catch {}
	}
	return state
}
