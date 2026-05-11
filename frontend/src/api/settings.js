import request from '../utils/request'

export const getSettings = () => 
  request.get('/settings')

export const updateSettings = (data) => 
  request.put('/settings', data)

export const getFinancialYears = () => 
  request.get('/settings/years')

export const createFinancialYear = (data) => 
  request.post('/settings/years', data)

export const closeFinancialYear = (id) => 
  request.put(`/settings/years/${id}/close`)

export const backupDatabase = () => 
  request.get('/settings/backup', { responseType: 'blob' })
