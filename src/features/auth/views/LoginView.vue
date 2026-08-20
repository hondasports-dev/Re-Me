<script setup lang="ts">
import Button from 'primevue/button'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import { authSession } from '../auth-session'

const route = useRoute()
const isSubmitting = ref(false)
const localError = ref<string | null>(null)

const routeError = computed(() => {
  const reason = typeof route.query.reason === 'string' ? route.query.reason : ''

  if (reason === 'session_restore_failed') {
    return '認証の設定またはセッションを確認できませんでした。設定を確認して、もう一度お試しください。'
  }

  return null
})

const errorMessage = computed(() => localError.value ?? routeError.value)

async function continueWithGoogle(): Promise<void> {
  if (isSubmitting.value) {
    return
  }

  isSubmitting.value = true
  localError.value = null

  try {
    await authSession.signInWithGoogle()
  } catch {
    localError.value =
      'Google ログインを開始できませんでした。少し待ってから、もう一度お試しください。'
    isSubmitting.value = false
  }
}
</script>

<template>
  <section class="auth-panel" aria-labelledby="login-title">
    <p class="auth-panel__brand">Re:Me</p>
    <h1 id="login-title">未来のあなたへ</h1>
    <p class="auth-panel__copy">今のあなたから、まだ見ぬ未来のあなたへ。</p>

    <p v-if="errorMessage" class="auth-panel__error" role="alert">{{ errorMessage }}</p>

    <Button
      class="auth-panel__action"
      :disabled="isSubmitting"
      :loading="isSubmitting"
      label="Googleで続ける"
      severity="secondary"
      @click="continueWithGoogle"
    />
  </section>
</template>
