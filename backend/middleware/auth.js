const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'finance-system-secret-key-2024';

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: '未登录' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'token无效或已过期' });
  }
};

const checkPermission = (permission) => {
  return (req, res, next) => {
    const user = req.user;
    if (user.role === 'admin') return next();
    const permissions = user.permissions || [];
    if (permissions.includes('all') || permissions.includes(permission)) {
      return next();
    }
    return res.status(403).json({ error: '没有权限' });
  };
};

module.exports = { auth, checkPermission, JWT_SECRET };
