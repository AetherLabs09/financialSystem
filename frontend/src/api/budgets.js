import request from '../utils/request'

export const getBudgets = (params) => 
  request.get('/budgets', { params })

export const getBudgetStatus = (params) => 
  request.get('/budgets/status', { params })

export const createBudget = (data) => 
  request.post('/budgets', data)

export const updateBudget = (id, data) => 
  request.put(`/budgets/${id}`, data)

export const deleteBudget = (id) => 
  request.delete(`/budgets/${id}`)
