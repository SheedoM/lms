<template>
	<div class="flex min-w-0 items-center gap-2.5">
		<img
			v-if="logo"
			:src="logo"
			:alt="__('Faragallah Tech')"
			class="size-9 shrink-0 rounded-lg object-contain"
		/>
		<div
			v-else
			aria-hidden="true"
			class="ft-brand-mark grid size-9 shrink-0 place-items-center rounded-lg"
		>
			FT
		</div>
		<div v-if="!collapsed" class="min-w-0">
			<div class="ft-display truncate text-base font-semibold text-white">
				Faragallah Tech
			</div>
			<div class="truncate text-[10px] uppercase tracking-[0.18em] text-[#aebcc2]">
				Learning systems
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { sessionStore } from '@/stores/session'

defineProps<{ collapsed?: boolean }>()

const { branding } = sessionStore()
const logo = computed(
	() =>
		branding.data?.app_logo?.file_url ||
		branding.data?.banner_image?.file_url ||
		null
)
</script>
