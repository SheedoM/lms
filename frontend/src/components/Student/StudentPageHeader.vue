<template>
	<header class="mb-7 flex flex-wrap items-end justify-between gap-4">
		<div>
			<p
				v-if="eyebrow"
				class="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ft-muted)]"
			>
				{{ eyebrow }}
			</p>
			<h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">
				{{ title }}
			</h1>
			<p v-if="description" class="mt-2 max-w-2xl text-sm leading-6 text-[var(--ft-muted)]">
				{{ description }}
			</p>
		</div>
		<slot />
	</header>
</template>

<script setup lang="ts">
defineProps<{
	title: string
	description?: string
	eyebrow?: string
}>()
</script>
