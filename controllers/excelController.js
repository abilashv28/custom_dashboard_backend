const XLSX = require('xlsx');
const fs = require('fs');
const { QueryTypes } = require('sequelize');
const sequelize = require('../config/db');
const ExcelData = require('../models/ExcelData');

exports.uploadExcel = async (req, res) => {
  if (!req.file) return res.status(400).send({ headerCode: 400, message: 'No file uploaded' });

  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    if (sheet.length === 0) {
      return res.status(400).send({ headerCode: 400, message: 'Excel sheet is empty' });
    }

    try {
      await ExcelData.bulkCreate(sheet, { validate: true });
      fs.unlinkSync(req.file.path);
      res.status(200).send({ headerCode: 600, message: 'Data inserted successfully' });
    } catch (error) {
      console.error('Error inserting data:', error);
      res.status(500).send({ headerCode: 500, message: 'Error inserting data' });
    }
  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).send({ headerCode: 500, message: 'Error processing file' });
  }
};

exports.getColumnNames = async (req, res) => {
  try {
    const result = await sequelize.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'excel_data' AND TABLE_SCHEMA = 'custom_dashboard'`,
      { type: QueryTypes.SELECT }
    );

    const columnNames = result.map(row => row.COLUMN_NAME);

    res.status(200).send({ headerCode: 600, columns: columnNames });
  } catch (error) {
    console.error('Error fetching column names:', error);
    res.status(500).send({ headerCode: 500, message: 'Error fetching column names' });
  }
};

exports.createDashboard = async (req, res) => {
  try {
    // Extract rows and values from query parameters
    const { rows, values } = req.query;

    // Validate the input parameters
    if (!rows || !values) {
      return res.status(400).send({
        header: { code: 400 },
        body: { value: null, error: 'Both "rows" and "values" query parameters are required' }
      });
    }

    // Construct the query dynamically based on input parameters
    const query = `
      SELECT ${rows}, COUNT(${values}) AS valueCount 
      FROM excel_data 
      GROUP BY ${rows}
    `;

    const result = await sequelize.query(query, {
      type: QueryTypes.SELECT,
    });

    // Construct the value object where each key is the row value and each value is the count
    const valueObject = {};
    result.forEach(row => {
      valueObject[row[rows]] = row.valueCount;
    });

    const response = {
      header: {
        code: 600
      },
      body: {
        value: valueObject,
        error: null
      }
    };

    res.status(200).send(response);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).send({
      header: { code: 500 },
      body: { value: null, error: 'Error fetching data' }
    });
  }
};





