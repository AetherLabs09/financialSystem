const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'db', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + Buffer.from(file.originalname, 'latin1').toString('utf8'));
  }
});
const upload = multer({ storage });

app.use('/uploads', express.static(uploadDir));

const db = require('./database');

const authRoutes = require('./routes/auth');
const categoryRoutes = require('./routes/categories');
const partnerRoutes = require('./routes/partners');
const transactionRoutes = require('./routes/transactions');
const receivableRoutes = require('./routes/receivables');
const budgetRoutes = require('./routes/budgets');
const voucherRoutes = require('./routes/vouchers');
const reimbursementRoutes = require('./routes/reimbursements');
const reportRoutes = require('./routes/reports');
const userRoutes = require('./routes/users');
const settingRoutes = require('./routes/settings');

app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/partners', partnerRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/receivables', receivableRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/api/reimbursements', reimbursementRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settings', settingRoutes);

app.use('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '没有上传文件' });
  }
  res.json({
    filename: req.file.filename,
    path: `/uploads/${req.file.filename}`,
    size: req.file.size
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const frontendPath = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`财务系统后端服务运行在端口 ${PORT}`);
});
