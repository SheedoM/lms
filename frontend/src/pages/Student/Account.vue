<template>
	<div class="mx-auto w-full max-w-5xl px-4 py-6 sm:px-7 lg:px-10 lg:py-9">
		<StudentPageHeader
			:title="__('Account')"
			:eyebrow="__('Faragallah Tech')"
			:description="__('Manage your profile, preferences, certificates, and session.')"
		/>

		<div class="grid gap-6 lg:grid-cols-[1fr,1.3fr]">
			<section class="ft-panel rounded-2xl p-6">
				<div class="flex items-center gap-4">
					<Avatar
						:image="userResource.data?.user_image"
						:label="userResource.data?.full_name"
						size="2xl"
					/>
					<div class="min-w-0">
						<h2 class="truncate text-xl font-semibold">
							{{ userResource.data?.full_name }}
						</h2>
						<p class="truncate text-sm text-[var(--ft-muted)]">
							{{ userResource.data?.email }}
						</p>
					</div>
				</div>
				<p v-if="userResource.data?.headline" class="mt-5 text-sm leading-6 text-[var(--ft-muted)]">
					{{ userResource.data.headline }}
				</p>
				<div class="mt-6 grid gap-2">
					<router-link
						:to="profileRoute"
						class="flex items-center justify-between rounded-xl border border-[var(--ft-border)] px-4 py-3 text-sm font-medium hover:bg-black/[0.025]"
					>
						<span class="flex items-center gap-2">
							<span class="lucide-user-round size-4 text-[var(--ft-muted)]" />
							{{ __('View or edit profile') }}
						</span>
						<span class="lucide-chevron-right size-4 rtl:rotate-180" />
					</router-link>
					<router-link
						:to="{
							name: 'ProfileCertificates',
							params: { username: userResource.data?.username },
						}"
						class="flex items-center justify-between rounded-xl border border-[var(--ft-border)] px-4 py-3 text-sm font-medium hover:bg-black/[0.025]"
					>
						<span class="flex items-center gap-2">
							<span class="lucide-award size-4 text-[var(--ft-muted)]" />
							{{ __('Certificates') }}
						</span>
						<span class="lucide-chevron-right size-4 rtl:rotate-180" />
					</router-link>
				</div>
			</section>

			<section class="ft-panel divide-y divide-[var(--ft-border)] rounded-2xl px-5 sm:px-6">
				<div class="flex items-center justify-between gap-5 py-5">
					<div>
						<h2 class="font-semibold">{{ __('Theme') }}</h2>
						<p class="mt-1 text-sm text-[var(--ft-muted)]">
							{{ theme === 'dark' ? __('Dark theme') : __('Light theme') }}
						</p>
					</div>
					<Button @click="toggleTheme">
						<template #prefix>
							<span :class="theme === 'dark' ? 'lucide-sun' : 'lucide-moon'" class="size-4" />
						</template>
						{{ __('Toggle') }}
					</Button>
				</div>
				<div class="flex items-center justify-between gap-5 py-5">
					<div>
						<h2 class="font-semibold">{{ __('Language and direction') }}</h2>
						<p class="mt-1 text-sm text-[var(--ft-muted)]">
							{{ profile.data?.language || windowLanguage }} ·
							{{ isRtl ? __('Right to left') : __('Left to right') }}
						</p>
					</div>
					<router-link :to="profileRoute" class="text-sm font-semibold underline decoration-[#9cff45] decoration-2 underline-offset-4">
						{{ __('Edit') }}
					</router-link>
				</div>
				<div class="flex items-center justify-between gap-5 py-5">
					<div>
						<h2 class="font-semibold">{{ __('Password') }}</h2>
						<p class="mt-1 text-sm text-[var(--ft-muted)]">
							{{ __('Use the existing secure password update flow.') }}
						</p>
					</div>
					<a
						href="/update-password"
						class="text-sm font-semibold underline decoration-[#9cff45] decoration-2 underline-offset-4"
					>
						{{ __('Change password') }}
					</a>
				</div>
				<div class="flex items-center justify-between gap-5 py-5">
					<div>
						<h2 class="font-semibold">{{ __('Session') }}</h2>
						<p class="mt-1 text-sm text-[var(--ft-muted)]">{{ __('Sign out of Faragallah Tech on this device.') }}</p>
					</div>
					<Button :loading="logout.loading" @click="logout.submit()">
						<template #prefix>
							<span class="lucide-log-out size-4" />
						</template>
						{{ __('Log out') }}
					</Button>
				</div>
			</section>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Avatar, Button, createResource, usePageMeta } from 'frappe-ui'
import StudentPageHeader from '@/components/Student/StudentPageHeader.vue'
import { usersStore } from '@/stores/user'
import { sessionStore } from '@/stores/session'
import { theme, toggleTheme } from '@/utils/theme'

const { userResource } = usersStore()
const { brand, logout } = sessionStore()
const isRtl = document.documentElement.dir === 'rtl'
const windowLanguage = window.lang || document.documentElement.lang || __('Default')
const profileRoute = computed(() => ({
	name: 'Profile',
	params: { username: userResource.data?.username },
}))
const profile = createResource({
	url: 'lms.lms.api.get_profile_details',
	params: { username: userResource.data?.username },
	auto: Boolean(userResource.data?.username),
})

usePageMeta(() => ({ title: __('Account'), icon: brand.favicon }))
</script>
