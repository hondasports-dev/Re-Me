<script setup lang="ts">
import Button from 'primevue/button'
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { authSession } from '../auth-session'

const route = useRoute()
const router = useRouter()
const status = ref<'error' | 'processing'>('processing')
const started = ref(false)

async function processCallback(): Promise<void> {
  if (started.value) {
    return
  }

  started.value = true
  const code = typeof route.query.code === 'string' ? route.query.code : ''
  const providerError = typeof route.query.error === 'string' || route.query.error_description

  // Remove one-time codes and provider error details before any asynchronous work.
  window.history.replaceState(window.history.state, '', '/auth/callback')

  if (providerError || !code) {
    status.value = 'error'
    return
  }

  try {
    await authSession.completeOAuthCallback(code)
    await router.replace({ name: 'home' })
  } catch {
    status.value = 'error'
  }
}

onMounted(processCallback)
</script>

<template>
  <section class="auth-panel" aria-labelledby="callback-title" aria-live="polite">
    <p class="auth-panel__brand">Re:Me</p>

    <template v-if="status === 'processing'">
      <h1 id="callback-title">扉をひらいています</h1>
      <p class="auth-panel__copy">未来へ続く場所を、静かに準備しています。</p>
      <span class="auth-panel__spinner" aria-hidden="true" />
    </template>

    <template v-else>
      <h1 id="callback-title" tabindex="-1">ログインを完了できませんでした</h1>
      <p class="auth-panel__error" role="alert">
        認証がキャンセルされたか、時間切れになりました。もう一度お試しください。
      </p>
      <Button
        class="auth-panel__action"
        label="ログインへ戻る"
        severity="secondary"
        @click="router.replace({ name: 'login' })"
      />
    </template>
  </section>
</template>
