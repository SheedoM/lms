<template>
	<nav
		v-if="mode === 'bottom'"
		:aria-label="__('Primary')"
		class="ft-student-nav fixed inset-x-0 bottom-0 z-40 flex h-[4.75rem] items-stretch border-t border-white/10 px-1 standalone:pb-3"
	>
		<router-link
			v-for="item in STUDENT_NAV_ITEMS"
			:key="item.to"
			:to="{ name: item.to }"
			:aria-label="navLabel(item)"
			:aria-current="isActive(item) ? 'page' : undefined"
			class="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg text-[10px] text-[#aebcc2] transition-colors"
			:class="{ 'bg-white/10 !text-[#9cff45]': isActive(item) }"
		>
			<component :is="icons[item.icon]" class="size-5" :stroke-width="1.8" />
			<span class="max-w-full truncate px-1">{{ navLabel(item) }}</span>
			<span
				v-if="item.to === 'StudentNotifications' && unreadCount"
				class="absolute end-[22%] top-2.5 min-w-4 rounded-full bg-[#9cff45] px-1 text-center text-[9px] font-semibold text-[#05131a]"
			>
				{{ unreadCount > 99 ? '99+' : unreadCount }}
			</span>
		</router-link>
	</nav>

	<div
		v-else
		class="relative h-full shrink-0 transition-[width] duration-200"
		:class="isWide ? 'w-56' : 'w-16'"
	>
		<aside
			class="ft-student-nav flex h-full flex-col border-e border-white/10 transition-[width] duration-200"
			:class="[
				isWide ? 'w-56' : 'w-16',
				mode === 'overlay'
					? 'absolute inset-y-0 start-0 z-40 shadow-2xl shadow-black/40'
					: '',
			]"
		>
			<div class="flex h-16 items-center px-3">
				<StudentBrand :collapsed="!isWide" />
			</div>

			<div class="mx-3 h-px bg-white/10" />

			<nav :aria-label="__('Primary')" class="flex flex-1 flex-col gap-1.5 px-2 py-5">
				<Tooltip
					v-for="item in STUDENT_NAV_ITEMS"
					:key="item.to"
					:text="navLabel(item)"
					placement="right"
					:disabled="isWide"
				>
					<router-link
						:to="{ name: item.to }"
						:aria-label="navLabel(item)"
						:aria-current="isActive(item) ? 'page' : undefined"
						class="group relative flex h-11 items-center rounded-lg text-[#aebcc2] outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-[#9cff45]"
						:class="[
							isWide ? 'gap-3 px-3' : 'justify-center px-0',
							isActive(item) ? 'bg-white/10 !text-[#9cff45]' : '',
						]"
					>
						<component
							:is="icons[item.icon]"
							class="size-5 shrink-0"
							:stroke-width="1.8"
						/>
						<span v-if="isWide" class="truncate text-sm font-medium">
							{{ navLabel(item) }}
						</span>
						<span
							v-if="item.to === 'StudentNotifications' && unreadCount"
							class="rounded-full bg-[#9cff45] px-1.5 text-[10px] font-semibold text-[#05131a]"
							:class="isWide ? 'ms-auto' : 'absolute end-1 top-1'"
						>
							{{ unreadCount > 99 ? '99+' : unreadCount }}
						</span>
					</router-link>
				</Tooltip>
			</nav>

			<div v-if="canControlWidth" class="border-t border-white/10 p-2">
				<Tooltip
					:text="
						isWide
							? mode === 'pinned'
								? __('Use compact navigation')
								: __('Pin navigation')
							: __('Expand navigation')
					"
					placement="right"
				>
					<button
						type="button"
						class="flex h-10 w-full items-center justify-center rounded-lg text-[#aebcc2] hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9cff45]"
						:aria-label="
							isWide
								? mode === 'pinned'
									? __('Use compact navigation')
									: __('Pin navigation')
								: __('Expand navigation')
						"
						@click="toggleWidth"
					>
						<PanelLeftClose v-if="mode === 'pinned'" class="size-5" />
						<Pin v-else-if="mode === 'overlay'" class="size-5" />
						<PanelLeftOpen v-else class="size-5" />
					</button>
				</Tooltip>
			</div>
		</aside>
		<button
			v-if="mode === 'overlay'"
			type="button"
			:aria-label="__('Close navigation')"
			class="fixed inset-0 z-30 cursor-default bg-black/20"
			@click="temporaryExpanded = false"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, ref } from 'vue'
import { Tooltip, createResource } from 'frappe-ui'
import { useRoute } from 'vue-router'
import {
	Bell,
	BookOpen,
	CircleUserRound,
	ClipboardCheck,
	Home,
	PanelLeftClose,
	PanelLeftOpen,
	Pin,
} from 'lucide-vue-next'
import StudentBrand from './StudentBrand.vue'
import {
	getStudentNavigationMode,
	STUDENT_NAV_ITEMS,
	type StudentSidebarPreference,
} from '@/composables/useStudentExperience'
import { useScreenSize } from '@/utils/composables'
import { useSidebar } from '@/stores/sidebar'
import { sessionStore } from '@/stores/session'

const route = useRoute()
const { size } = useScreenSize()
const sidebar = useSidebar()
const { user } = sessionStore()
const socket = inject<any>('$socket')
const temporaryExpanded = ref(false)
const unreadCount = ref(0)
const icons = {
	Bell,
	BookOpen,
	CircleUserRound,
	ClipboardCheck,
	House: Home,
}

const mode = computed(() =>
	getStudentNavigationMode({
		width: size.width,
		height: size.height,
		preference: sidebar.studentSidebarPreference as StudentSidebarPreference,
		temporaryExpanded: temporaryExpanded.value,
		focusMode: sidebar.isSidebarCollapsed,
	})
)

const isWide = computed(() =>
	['expanded', 'overlay', 'pinned'].includes(mode.value)
)
const canControlWidth = computed(() =>
	['rail', 'overlay', 'pinned'].includes(mode.value)
)

const unreadNotifications = createResource({
	cache: 'Unread Notifications Count',
	url: 'frappe.client.get_count',
	makeParams() {
		return {
			doctype: 'Notification Log',
			filters: { for_user: user, read: 0 },
		}
	},
	onSuccess(data) {
		unreadCount.value = Number(data || 0)
	},
	auto: Boolean(user),
})

function navLabel(item: (typeof STUDENT_NAV_ITEMS)[number]) {
	return document.documentElement.dir === 'rtl' ? item.labelAr : __(item.label)
}

function isActive(item: (typeof STUDENT_NAV_ITEMS)[number]) {
	return item.activeFor.includes(route.name as never)
}

function toggleWidth() {
	if (mode.value === 'pinned') {
		sidebar.setStudentSidebarPreference('compact')
		temporaryExpanded.value = false
	} else if (mode.value === 'overlay') {
		sidebar.setStudentSidebarPreference('pinned')
		temporaryExpanded.value = false
	} else {
		temporaryExpanded.value = true
	}
}

function refreshCount() {
	unreadNotifications.reload()
}

onMounted(() => socket?.on('publish_lms_notifications', refreshCount))
onUnmounted(() => socket?.off('publish_lms_notifications', refreshCount))
</script>
