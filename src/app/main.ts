import { createApp } from 'vue'

import App from './App.vue'
import { registerProviders } from './providers'
import router from '../router'
import '../styles/base.css'
import '../styles/motion.css'

const app = createApp(App)

app.use(router)
registerProviders(app)
app.mount('#app')
