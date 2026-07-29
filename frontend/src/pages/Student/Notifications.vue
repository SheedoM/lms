<!-- eslint-disable vue/no-v-html -->
<template>
	<div class="mx-auto w-full max-w-5xl px-4 py-6 sm:px-7 lg:px-10 lg:py-9">
		<StudentPageHeader
			:title="__('Notifications')"
			:eyebrow="__('Faragallah Tech')"
			:description="__('Updates from your courses, groups, and learning activity.')"
		>
			<Button
				v-if="hasUnread"
				:loading="markAllAsRead.loading"
				@click="markAllAsRead.submit"
			>
				<template #prefix>
					<span class="lucide-check-check size-4" />
				</template>
				{{ __('Mark all as read') }}
			</Button>
		</StudentPageHeader>

		<section class="ft-panel overflow-hidden rounded-2xl">
			<div class="flex gap-1 border-b border-[var(--ft-border)] p-3">
				<button
					v-for="filter in filters"
					:key="filter.value"
					type="button"
					class="rounded-lg px-4 py-2 text-sm font-medium text-[var(--ft-muted)]"
					:class="{ 'bg-[#9cff45] !text-[#05131a]': activeFilter === filter.value }"
					@click="activeFilter = filter.value"
				>
					{{ filter.label }}
				</button>
			</div>
			<div v-if="notifications.loading && !notifications.data" class="grid place-items-center py-24">
				<LoadingIndicator class="size-5" />
			</div>
			<div v-else-if="filtered.length" class="divide-y divide-[var(--ft-border)]">
				<button
					v-for="notification in filtered"
					:key="notification.name"
					type="button"
					class="flex w-full items-start gap-3 px-4 py-4 text-start transition-colors hover:bg-black/[0.025] sm:px-6"
					@click="selectNotification(notification)"
				>
					<span
						class="mt-2 size-2 shrink-0 rounded-full"
						:class="notification.read ? 'bg-transparent' : 'bg-[#9cff45]'"
					/>
					<Avatar
						:image="notification.from_user_details?.user_image"
						:label="notification.from_user_details?.full_name || __('Notification')"
						size="lg"
					/>
					<span class="min-w-0 flex-1">
						<span class="block text-sm leading-6" v-html="sanitizeHTML(notification.subject)" />
						<span class="mt-1 block text-xs text-[var(--ft-muted)]">
							{{ dayjs(notification.creation).fromNow() }}
						</span>
					</span>
				</button>
			</div>
			<div v-else class="px-6 py-20 text-center">
				<div class="mx-auto grid size-12 place-items-center rounded-xl bg-black/5 text-[var(--ft-muted)]">
					<span class="lucide-bell size-5" />
				</div>
				<h2 class="mt-4 text-lg font-semibold">
					{{ activeFilter === 'unread' ? __('No unread notifications') : __('No notifications yet') }}
				</h2>
				<p class="mt-2 text-sm text-[var(--ft-muted)]">
					{{ activeFilter === 'unread' ? __("You're all caught up.") : __('New learning updates will appear here.') }}
				</p>
			</div>
		</section>
	</div>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, ref } from 'vue'
import { Avatar, Button, LoadingIndicator, usePageMeta } from 'frappe-ui'
import { useRouter } from 'vue-router'
import StudentPageHeader from '@/components/Student/StudentPageHeader.vue'
import { sanitizeHTML } from '@/utils'
import {
	markAllAsRead,
	markAsRead,
	notifications,
} from '@/stores/notifications'
import { notificationRoute } from '@/utils/notifications'
import { sessionStore } from '@/stores/session'

const dayjs = inject<any>('$dayjs')
const socket = inject<any>('$socket')
const router = useRouter()
const { brand } = sessionStore()
const activeFilter = ref<'all' | 'unread'>('all')
const filters = computed(() => [
	{ label: __('All'), value: 'all' as const },
	{ label: __('Unread'), value: 'unread' as const },
])
const filtered = computed(() => {
	const rows = notifications.data || []
	return activeFilter.value === 'unread'
		? rows.filter((row: any) => !row.read)
		: rows
})
const hasUnread = computed(() =>
	notifications.data?.some((row: any) => !row.read)
)

function selectNotification(notification: any) {
	if (!notification.read) markAsRead.submit({ name: notification.name })
	const route = notificationRoute(notification)
	if (route) router.push(route)
}
function reload() {
	notifications.reload()
}

onMounted(() => {
	reload()
	socket?.on('publish_lms_notifications', reload)
})
onUnmounted(() => socket?.off('publish_lms_notifications', reload))

usePageMeta(() => ({ title: __('Notifications'), icon: brand.favicon }))
</script>
