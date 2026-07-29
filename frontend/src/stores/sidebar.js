import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSidebar = defineStore('sidebar', () => {
	const isSidebarCollapsed = ref(false)
	const isWebpagesCollapsed = ref(true)
	const storedStudentPreference = localStorage.getItem(
		'faragallahStudentSidebarPreference'
	)
	const studentSidebarPreference = ref(
		storedStudentPreference === 'pinned' ? 'pinned' : 'compact'
	)

	if (localStorage.getItem('isSidebarCollapsed')) {
		isSidebarCollapsed.value = JSON.parse(
			localStorage.getItem('isSidebarCollapsed')
		)
	}

	if (localStorage.getItem('isWebpagesCollapsed')) {
		isWebpagesCollapsed.value = JSON.parse(
			localStorage.getItem('isWebpagesCollapsed')
		)
	}

	const setStudentSidebarPreference = (preference) => {
		studentSidebarPreference.value =
			preference === 'pinned' ? 'pinned' : 'compact'
		localStorage.setItem(
			'faragallahStudentSidebarPreference',
			studentSidebarPreference.value
		)
	}

	return {
		isSidebarCollapsed,
		isWebpagesCollapsed,
		studentSidebarPreference,
		setStudentSidebarPreference,
	}
})
