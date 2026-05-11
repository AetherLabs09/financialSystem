import request from '../utils/request'

export const getReportSummary = (params) => 
  request.get('/reports/summary', { params })

export const getReportByCategory = (params) => 
  request.get('/reports/by-category', { params })

export const getReportByDate = (params) => 
  request.get('/reports/by-date', { params })

export const getReportMonthly = (params) => 
  request.get('/reports/monthly', { params })

export const getReportByPartner = (params) => 
  request.get('/reports/by-partner', { params })
