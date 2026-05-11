import request from '../utils/request'

export const getReceivables = (params) => 
  request.get('/receivables', { params })

export const getReceivablesSummary = () => 
  request.get('/receivables/summary')

export const createReceivable = (data) => 
  request.post('/receivables', data)

export const updateReceivable = (id, data) => 
  request.put(`/receivables/${id}`, data)

export const deleteReceivable = (id) => 
  request.delete(`/receivables/${id}`)
