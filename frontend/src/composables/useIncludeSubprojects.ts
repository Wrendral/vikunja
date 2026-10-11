import {computed} from 'vue'
import {useAuthStore} from '@/stores/auth'

export const INCLUDE_SUBPROJECTS_QUERY_PARAM = 'include_subprojects'

export function useIncludeSubprojects() {
	const authStore = useAuthStore()
	return computed(() => authStore.settings.frontend_settings?.include_subprojects === true)
}
