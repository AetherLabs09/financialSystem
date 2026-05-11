import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '../stores/user'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    component: () => import('../views/Layout.vue'),
    redirect: '/dashboard',
    meta: { requiresAuth: true },
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('../views/Dashboard.vue'),
        meta: { title: '仪表盘', icon: 'Odometer' }
      },
      {
        path: 'categories',
        name: 'Categories',
        component: () => import('../views/Categories.vue'),
        meta: { title: '收支类目', icon: 'Menu', permission: 'category:read' }
      },
      {
        path: 'transactions',
        name: 'Transactions',
        component: () => import('../views/Transactions.vue'),
        meta: { title: '收支记账', icon: 'Wallet', permission: 'transaction:read' }
      },
      {
        path: 'partners',
        name: 'Partners',
        component: () => import('../views/Partners.vue'),
        meta: { title: '往来单位', icon: 'OfficeBuilding', permission: 'partner:read' }
      },
      {
        path: 'receivables',
        name: 'Receivables',
        component: () => import('../views/Receivables.vue'),
        meta: { title: '应收应付', icon: 'Money', permission: 'receivable:read' }
      },
      {
        path: 'budgets',
        name: 'Budgets',
        component: () => import('../views/Budgets.vue'),
        meta: { title: '预算管理', icon: 'DataLine', permission: 'budget:read' }
      },
      {
        path: 'reimbursements',
        name: 'Reimbursements',
        component: () => import('../views/Reimbursements.vue'),
        meta: { title: '报销管理', icon: 'Document' }
      },
      {
        path: 'reports',
        name: 'Reports',
        component: () => import('../views/Reports.vue'),
        meta: { title: '财务报表', icon: 'DataAnalysis' }
      },
      {
        path: 'users',
        name: 'Users',
        component: () => import('../views/Users.vue'),
        meta: { title: '用户管理', icon: 'User', permission: 'user:read' }
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('../views/Settings.vue'),
        meta: { title: '系统设置', icon: 'Setting', permission: 'setting:read' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const userStore = useUserStore()
  
  if (to.meta.requiresAuth !== false && !userStore.token) {
    next('/login')
  } else if (to.path === '/login' && userStore.token) {
    next('/dashboard')
  } else {
    next()
  }
})

export default router
