import request from '../utils/request'

export const getPartners = (params) => 
  request.get('/partners', { params })

export const getPartner = (id) => 
  request.get(`/partners/${id}`)

export const createPartner = (data) => 
  request.post('/partners', data)

export const updatePartner = (id, data) => 
  request.put(`/partners/${id}`, data)

export const deletePartner = (id) => 
  request.delete(`/partners/${id}`)
