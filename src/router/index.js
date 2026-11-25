import { createRouter, createWebHistory } from 'vue-router'
import RadarView from '../views/RadarView.vue'
import PartnerTable from '../views/PartnerTable.vue'

const routes = [
  {
    path: '/',
    redirect: '/partner-table' // Redirige la raíz al directorio por defecto
  },
  {
    path: '/partner-table',
    name: 'Partner Table',
    component: PartnerTable
  },
  {
    path: '/radar',
    name: 'Radar',
    component: RadarView
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router