<template>
	<div
		class="inline-flex items-center gap-0.5 rounded-md border border-outline-gray-2 bg-surface-gray-1 p-0.5 text-xs font-medium"
		role="group"
		:aria-label="__('Language')"
	>
		<button
			type="button"
			class="rounded px-2 py-1 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
			:class="
				isArabic
					? 'bg-surface-white text-ink-gray-9 shadow-sm'
					: 'text-ink-gray-5 hover:text-ink-gray-7'
			"
			:aria-pressed="isArabic"
			:disabled="switching"
			@click="switchTo('ar')"
		>
			العربية
		</button>
		<button
			type="button"
			class="rounded px-2 py-1 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
			:class="
				!isArabic
					? 'bg-surface-white text-ink-gray-9 shadow-sm'
					: 'text-ink-gray-5 hover:text-ink-gray-7'
			"
			:aria-pressed="!isArabic"
			:disabled="switching"
			@click="switchTo('en')"
		>
			English
		</button>
	</div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { call } from 'frappe-ui'
import { sessionStore } from '@/stores/session'

const { user } = sessionStore()
const switching = ref(false)
const isArabic = computed(() => document.documentElement.dir === 'rtl')

async function switchTo(language) {
	if (switching.value) return
	if ((language === 'ar') === isArabic.value) return
	switching.value = true
	try {
		if (user.value) {
			// Same call the original "Language" field in Edit Profile used
			// (frappe.client.set_value on User.language), just triggered
			// from a two-button toggle instead of a full language dropdown.
			await call('frappe.client.set_value', {
				doctype: 'User',
				name: user.value,
				fieldname: 'language',
				value: language,
			})
		}
	} finally {
		window.location.reload()
	}
}
</script>
