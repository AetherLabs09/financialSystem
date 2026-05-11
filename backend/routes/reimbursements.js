const express = require('express');
const router = express.Router();
const db = require('../database');
const { auth, checkPermission } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const generateReimburseNo = () => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `BX${date}${random}`;
};

router.get('/', auth, (req, res) => {
  const { status, applicantId, page = 1, pageSize = 20 } = req.query;
  let sql = `SELECT r.*, u.real_name as applicant_name, c.name as category_name, a.real_name as approver_name
    FROM reimbursements r 
    LEFT JOIN users u ON r.applicant_id = u.id 
    LEFT JOIN categories c ON r.category_id = c.id 
    LEFT JOIN users a ON r.approved_by = a.id 
    WHERE 1=1`;
  const params = [];
  
  if (status) {
    sql += ' AND r.status = ?';
    params.push(status);
  }
  if (applicantId) {
    sql += ' AND r.applicant_id = ?';
    params.push(applicantId);
  }
  
  const countSql = sql.replace('SELECT r.*, u.real_name as applicant_name, c.name as category_name, a.real_name as approver_name', 'SELECT COUNT(*) as total');
  const totalResult = db.prepare(countSql).get(...params);
  const total = totalResult.total;
  
  sql += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));
  
  const reimbursements = db.prepare(sql).all(...params);
  res.json({ list: reimbursements, total, page: parseInt(page), pageSize: parseInt(pageSize) });
});

router.get('/:id', auth, (req, res) => {
  const { id } = req.params;
  const reimbursement = db.prepare(`
    SELECT r.*, u.real_name as applicant_name, c.name as category_name, a.real_name as approver_name
    FROM reimbursements r 
    LEFT JOIN users u ON r.applicant_id = u.id 
    LEFT JOIN categories c ON r.category_id = c.id 
    LEFT JOIN users a ON r.approved_by = a.id 
    WHERE r.id = ?
  `).get(id);
  
  if (!reimbursement) {
    return res.status(404).json({ error: '报销单不存在' });
  }
  
  res.json(reimbursement);
});

router.post('/', auth, (req, res) => {
  const { amount, categoryId, description, voucherPaths } = req.body;
  
  const serialNo = generateReimburseNo();
  const result = db.prepare(`
    INSERT INTO reimbursements (serial_no, applicant_id, amount, category_id, description, voucher_paths)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(serialNo, req.user.id, amount, categoryId, description, voucherPaths);
  
  db.prepare('INSERT INTO audit_logs (user_id, action, module, target_id, details) VALUES (?, ?, ?, ?, ?)').run(req.user.id, '提交', '报销', result.lastInsertRowid, `报销金额 ${amount}`);
  
  res.json({ id: result.lastInsertRowid, serialNo, message: '提交成功' });
});

router.put('/:id/approve', auth, checkPermission('reimbursement:approve'), (req, res) => {
  const { id } = req.params;
  const { status, rejectReason } = req.body;
  
  if (status === 'approved') {
    db.prepare(`
      UPDATE reimbursements SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(req.user.id, id);
  } else if (status === 'rejected') {
    db.prepare(`
      UPDATE reimbursements SET status = 'rejected', approved_by = ?, approved_at = CURRENT_TIMESTAMP, reject_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(req.user.id, rejectReason, id);
  }
  
  db.prepare('INSERT INTO audit_logs (user_id, action, module, target_id, details) VALUES (?, ?, ?, ?, ?)').run(req.user.id, status === 'approved' ? '审批通过' : '审批拒绝', '报销', id, rejectReason || '');
  
  res.json({ message: '审批完成' });
});

router.put('/:id/pay', auth, checkPermission('reimbursement:pay'), (req, res) => {
  const { id } = req.params;
  
  db.prepare(`
    UPDATE reimbursements SET payment_status = 'paid', updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(id);
  
  db.prepare('INSERT INTO audit_logs (user_id, action, module, target_id) VALUES (?, ?, ?, ?)').run(req.user.id, '打款', '报销', id);
  
  res.json({ message: '打款完成' });
});

router.delete('/:id', auth, (req, res) => {
  const { id } = req.params;
  
  const reimbursement = db.prepare('SELECT * FROM reimbursements WHERE id = ?').get(id);
  if (!reimbursement) {
    return res.status(404).json({ error: '报销单不存在' });
  }
  
  if (reimbursement.status !== 'pending') {
    return res.status(400).json({ error: '只能删除待审批的报销单' });
  }
  
  db.prepare('DELETE FROM reimbursements WHERE id = ?').run(id);
  db.prepare('INSERT INTO audit_logs (user_id, action, module, target_id) VALUES (?, ?, ?, ?)').run(req.user.id, '删除', '报销', id);
  
  res.json({ message: '删除成功' });
});

module.exports = router;
