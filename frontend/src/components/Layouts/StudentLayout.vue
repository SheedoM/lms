<template>
	<div class="ft-student-experience flex h-screen w-screen overflow-hidden">
		<a
			href="#student-main-content"
			@click.prevent="skipToContent('student-main-content')"
			class="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[#9cff45] focus:px-4 focus:py-2 focus:text-[#05131a]"
		>
			{{ __('Skip to main content') }}
		</a>
		<StudentNavigation />
		<main
			id="student-main-content"
			tabindex="-1"
			class="ft-grid min-w-0 flex-1 overflow-auto bg-[var(--ft-canvas)] text-[var(--ft-ink)] focus:outline-none"
			:class="{ 'pb-20': usesBottomNavigation }"
		>
			<slot />
		</main>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import StudentNavigation from '@/components/Student/StudentNavigation.vue'
import { skipToContent } from '@/utils/a11y'
import { useScreenSize } from '@/utils/composables'
import { getStudentNavigationMode } from '@/composables/useStudentExperience'
import { useSidebar } from '@/stores/sidebar'

const { size } = useScreenSize()
const sidebar = useSidebar()
const usesBottomNavigation = computed(
	() =>
		getStudentNavigationMode({
			width: size.width,
			height: size.height,
			preference: sidebar.studentSidebarPreference,
			focusMode: sidebar.isSidebarCollapsed,
		}) === 'bottom'
)
</script>
