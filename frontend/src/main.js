import './index.css'
import { createApp, watch } from 'vue'
import router from './router'
import App from './App.vue'
import { createPinia } from 'pinia'
import dayjs from '@/utils/dayjs'
import { setDayjsLanguage } from '@/utils/dayjs'
import { createDialog } from '@/utils/dialogs'
import translationPlugin, { initializeTranslations } from './translation'
import { usersStore } from './stores/user'
import { initSocket } from './socket'
import { FrappeUI, setConfig, frappeRequest, pageMetaPlugin } from 'frappe-ui'
import { telemetryPlugin } from 'frappe-ui/frappe'

setConfig('resourceFetcher', frappeRequest)

async function bootstrap() {
	const activeLanguage = await initializeTranslations()
	setDayjsLanguage(activeLanguage)

	const pinia = createPinia()
	const app = createApp(App)

	app.use(FrappeUI)
	app.use(pinia)
	app.use(router)
	app.use(translationPlugin)
	app.use(pageMetaPlugin)
	app.provide('$dayjs', dayjs)
	app.provide('$socket', initSocket())
	app.mount('#app')

	const { userResource, allUsers } = usersStore()
	app.provide('$user', userResource)
	app.provide('$allUsers', allUsers)

	watch(userResource, () => {
		if (userResource.data) {
			app.use(telemetryPlugin, { app_name: 'lms' })
		}
	})

	app.config.globalProperties.$user = userResource
	app.config.globalProperties.$dialog = createDialog
}

bootstrap()
