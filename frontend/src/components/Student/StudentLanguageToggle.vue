<template>
	<div
		class="inline-flex items-center rounded-lg border border-[var(--ft-border)] bg-[var(--ft-surface)] p-1 text-xs font-semibold shadow-sm"
		dir="ltr"
		aria-label="Dashboard language"
	>
		<button
			v-for="option in options"
			:key="option.value"
			type="button"
			class="rounded-md px-2.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9cff45]"
			:class="
				activeLanguage === option.value
					? 'bg-[#9cff45] text-[#05131a]'
					: 'text-[var(--ft-muted)] hover:text-[var(--ft-ink)]'
			"
			:aria-pressed="activeLanguage === option.value"
			@click="changeLanguage(option.value)"
		>
			{{ option.label }}
		</button>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
	preferredStudentLanguage,
	selectStudentLanguage,
} from '@/translation'

const options = [
	{ value: 'en', label: 'EN' },
	{ value: 'ar', label: 'العربية' },
]
const activeLanguage = ref(preferredStudentLanguage())

function changeLanguage(language: string) {
	if (language === activeLanguage.value) return
	if (!selectStudentLanguage(language)) return
	activeLanguage.value = language
	window.location.reload()
}
</script>
