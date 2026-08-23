import { handleWorkerFetch } from './app'

const worker = {
  fetch: handleWorkerFetch,
  scheduled: async (): Promise<void> => {
    // Delivery and notification jobs will be added in later issues.
  },
}

export default worker satisfies ExportedHandler
