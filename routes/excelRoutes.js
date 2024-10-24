const express = require('express');
const multer = require('multer');
const excelController = require('../controllers/excelController');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Existing route for uploading Excel
router.post('/upload-excel', upload.single('file'), excelController.uploadExcel);

// New route for fetching column names
router.get('/get-column-names', excelController.getColumnNames);

router.get('/dashboard', excelController.createDashboard);



module.exports = router;
