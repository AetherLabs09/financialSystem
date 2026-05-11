import request from '../utils/request'

export const getTransactions = (params) => 
  request.get('/transactions', { params })

export const getTransaction = (id) => 
  request.get(`/transactions/${id}`)

export const createTransaction = (data) => 
  request.post('/transactions', data)

export const updateTransaction = (id, data) => 
  request.put(`/transactions/${id}`, data)

export const deleteTransaction = (id) => 
  request.delete(`/transactions/${id}`)

export const exportTransactions = (params) => 
  request.get('/transactions/export', { params, responseType: 'blob' })
