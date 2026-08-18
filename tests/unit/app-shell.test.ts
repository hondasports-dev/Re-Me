import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import App from '../../src/app/App.vue'
import router from '../../src/router'

describe('AppShell', () => {
  it('renders the mobile-first welcome shell', async () => {
    await router.push('/')
    await router.isReady()

    const wrapper = mount(App, {
      global: {
        plugins: [router],
      },
    })

    expect(wrapper.get('[aria-label="Re:Me 未来のあなたへ"]').text()).toContain('Re:Me')
    expect(wrapper.get('h1').text()).toBe('未来のあなたへ')
  })
})
