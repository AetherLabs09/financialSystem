import request from '../utils/request'

export const getReimbursements = (params) => 
  request.get('/reimbursements', { params })

export const getReimbursement = (id) => 
  request.get(`/reimbursements/${id}`)

export const createReimbursement = (data) => 
  request.post('/reimbursements', data)

export const approveReimbursement = (id, data) => 
  request.put(`/reimbursements/${id}/approve`, data)

export const payReimbursement = (id) => 
  request.put(`/reimbursements/${id}/pay`)

export const deleteReimbursement = (id) => 
  request.delete(`/reimbursements/${id}`)
