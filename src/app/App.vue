<script setup lang="ts">
import Button from 'primevue/button'
import { ref } from 'vue'

import { authSession } from '../features/auth/auth-session'

const logoutError = ref<string | null>(null)
const isLoggingOut = ref(false)

async function logout(): Promise<void> {
  if (isLoggingOut.value) {
    return
  }

  isLoggingOut.value = true
  logoutError.value = null

  try {
    await authSession.signOut()
  } catch {
    logoutError.value = 'ログアウト処理を完了できませんでした。認証が必要な内容は閉じました。'
  } finally {
    isLoggingOut.value = false
  }
}
</script>

<template>
  <div class="app-shell">
    <header class="app-shell__header">
      <div class="brand-mark" aria-label="Re:Me 未来のあなたへ">
        <span class="brand-mark__name">Re:Me</span>
        <span class="brand-mark__tagline">未来のあなたへ</span>
      </div>

      <Button
        v-if="authSession.session.value"
        class="app-shell__logout"
        :disabled="isLoggingOut"
        label="ログアウト"
        severity="secondary"
        text
        @click="logout"
      />
    </header>

    <p v-if="logoutError" class="app-shell__alert" role="alert">{{ logoutError }}</p>

    <main class="app-shell__main">
      <RouterView />
    </main>
  </div>
</template>
