const express = require('express');
const multer = require('multer');
const excelController = require('../controllers/excelController');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post('/upload-excel', upload.single('file'), excelController.uploadExcel);

router.get('/get-column-names', excelController.getColumnNames);

router.post('/dashboard', excelController.createDashboard);

router.get('/view-details',excelController.viewDetails)

router.post('/create-drilldown-chart',excelController.createDrilldownChart)

router.post('/fetch-details',excelController.fetchDetails)


module.exports = router;
