import {computed, type ComputedGetter, type DeepReadonly, type ComputedRef} from 'vue'
import {useAuthStore} from '@/stores/auth'
import type {IProjectView} from '@/modelTypes/IProjectView'

export const INCLUDE_SUBPROJECTS_QUERY_PARAM = 'include_subprojects'

export function useIncludeSubprojects(
	viewGetter: ComputedGetter<IProjectView | DeepReadonly<IProjectView> | undefined>,
): ComputedRef<boolean> {
	void viewGetter
	const authStore = useAuthStore()

	return computed(() => authStore.settings.frontendSettings.includeSubprojects === true)
}
