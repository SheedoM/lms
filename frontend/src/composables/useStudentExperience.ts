import { computed, type Ref } from 'vue'
import { usersStore } from '@/stores/user'
import { isPureStudentData } from '@/utils/studentExperience'

export * from '@/utils/studentExperience'

export function usePureStudent(): Ref<boolean> {
	const { userResource } = usersStore()
	return computed(() => isPureStudentData(userResource.data))
}
