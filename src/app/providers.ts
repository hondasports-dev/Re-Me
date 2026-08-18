import PrimeVue from 'primevue/config'
import type { App } from 'vue'

import { reMePreset } from '../styles/primevue'

export function registerProviders(app: App): void {
  app.use(PrimeVue, {
    theme: {
      preset: reMePreset,
      options: {
        darkModeSelector: false,
      },
    },
  })
}
