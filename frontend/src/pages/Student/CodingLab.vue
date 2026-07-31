<template>
	<div
		class="flex h-full min-h-0 w-full flex-col p-3 sm:p-4"
		dir="ltr"
		lang="en"
	>
		<div class="mb-3 flex shrink-0 flex-wrap items-end justify-between gap-3">
			<div>
				<p class="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ft-muted)]">
					Free workspace
				</p>
				<h1 class="mt-0.5 text-2xl font-semibold">Coding Lab</h1>
				<p class="text-sm text-[var(--ft-muted)]">Experiment freely.</p>
			</div>
			<div
				class="inline-flex rounded-xl border border-[var(--ft-border)] bg-[var(--ft-surface)] p-1"
				dir="ltr"
			>
				<button
					v-for="option in modes"
					:key="option.value"
					type="button"
					class="rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
					:class="
						mode === option.value
							? 'bg-[#9cff45] text-[#05131a]'
							: 'text-[var(--ft-muted)] hover:text-[var(--ft-ink)]'
					"
					@click="setMode(option.value)"
				>
					{{ option.label }}
				</button>
			</div>
		</div>

		<div class="coding-lab-standalone-shell min-h-0 flex-1">
			<CodingLabWorkspace
				:key="mode"
				:labs="[activeLab]"
				:active-lab="activeLab"
				:context="context"
				:show-close="false"
				:show-header="false"
				:confirm-reset="true"
				:initial-console-height="120"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { usePageMeta } from 'frappe-ui'
import CodingLabWorkspace from '@/components/CodingLabWorkspace.vue'
import { normalizeCodingLab } from '@/utils/codingLab/schema'
import { sessionStore } from '@/stores/session'

const MODE_KEY = 'ft:coding-lab:mode'
const modes = [
	{ value: 'python', label: 'Python' },
	{ value: 'javascript', label: 'JavaScript' },
	{ value: 'web', label: 'Web' },
] as const
type Mode = (typeof modes)[number]['value']

const user = inject<any>('$user')
const { brand } = sessionStore()
const mode = ref<Mode>(readMode())

const activeLab = computed(() => {
	if (mode.value === 'python')
		return normalizeCodingLab({
			block_id: 'free-python',
			title: 'Python Workspace',
			lab_kind: 'python',
			starter_files: { python: '' },
		})
	if (mode.value === 'javascript')
		return normalizeCodingLab({
			block_id: 'free-javascript',
			title: 'JavaScript Workspace',
			lab_kind: 'web',
			enabled_web_files: ['javascript'],
			starter_files: { javascript: '' },
		})
	return normalizeCodingLab({
		block_id: 'free-web',
		title: 'Web Workspace',
		lab_kind: 'web',
		enabled_web_files: ['html', 'css', 'javascript'],
		starter_files: { html: '', css: '', javascript: '' },
	})
})
const context = computed(() => ({
	user: user.data?.name || 'student',
	course: 'free-coding-lab',
	chapter: 'workspace',
	lesson: mode.value,
	authorPreview: false,
}))

function readMode(): Mode {
	try {
		const saved = globalThis.localStorage?.getItem(MODE_KEY) as Mode
		if (modes.some((item) => item.value === saved)) return saved
	} catch {
		// Use the default when storage is unavailable.
	}
	return 'python'
}

function setMode(next: Mode) {
	mode.value = next
	try {
		globalThis.localStorage?.setItem(MODE_KEY, next)
	} catch {
		// The workspace remains usable without persistence.
	}
}

usePageMeta(() => ({ title: 'Coding Lab', icon: brand.favicon }))
</script>
