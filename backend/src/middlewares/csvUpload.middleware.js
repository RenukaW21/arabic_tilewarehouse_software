'use strict';
const multer = require('multer');

// Use memory storage — we only need the file buffer (no disk persistence for CSVs).
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['text/csv', 'application/vnd.ms-excel', 'text/plain', 'application/octet-stream'];
    const isExtCsv = file.originalname.toLowerCase().endsWith('.csv');
    if (isExtCsv || allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  },
});

module.exports = csvUpload;
