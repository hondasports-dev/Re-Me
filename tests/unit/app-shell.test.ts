import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import App from '../../src/app/App.vue'
import router from '../../src/router'

describe('AppShell', () => {
  it('redirects an anonymous visitor to the mobile-first login shell', async () => {
    await router.push('/')
    await router.isReady()

    const wrapper = mount(App, {
      global: {
        plugins: [router],
      },
    })

    expect(wrapper.get('[aria-label="Re:Me 未来のあなたへ"]').text()).toContain('Re:Me')
    expect(router.currentRoute.value.name).toBe('login')
    expect(wrapper.get('h1').text()).toBe('未来のあなたへ')
    expect(wrapper.get('button').text()).toContain('Googleで続ける')
  })
})
