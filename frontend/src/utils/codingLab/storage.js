const STORAGE_PREFIX = 'lms:coding-lab:v4'

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

export function loadLabState(
	storage,
	context,
	blockId,
	starterFiles,
	starterRevision,
	preferences = {}
) {
	const fallback = {
		files: { ...starterFiles },
		starterRevision,
		starterUpdated: false,
		consoleOpen: preferences.console_open !== false,
		consoleHeight: Number(preferences.console_height) || 180,
	}
	if (context.authorPreview || !storage) return fallback
	try {
		const saved = JSON.parse(
			storage.getItem(codingLabStorageKey(context, blockId)) || 'null'
		)
		if (!saved || typeof saved !== 'object') return fallback
		if (saved.starterRevision !== starterRevision) {
			const updated = { ...fallback, starterUpdated: true }
			storage.setItem(
				codingLabStorageKey(context, blockId),
				JSON.stringify(updated)
			)
			return updated
		}
		return {
			...fallback,
			...saved,
			files: { ...starterFiles, ...(saved.files || {}) },
			starterRevision,
			starterUpdated: false,
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

export function resetLabState(
	storage,
	context,
	blockId,
	starterFiles,
	starterRevision
) {
	const state = {
		files: { ...starterFiles },
		starterRevision,
		starterUpdated: false,
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
