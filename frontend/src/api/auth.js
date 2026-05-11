import request from '../utils/request'

export const login = (username, password) => 
  request.post('/auth/login', { username, password })

export const verifyToken = () => 
  request.get('/auth/verify')

export const changePassword = (data) => 
  request.post('/auth/change-password', data)
