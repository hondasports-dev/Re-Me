import { createRouter, createWebHistory } from 'vue-router'

import HomeView from '../features/home/views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
  ],
})

export default router
