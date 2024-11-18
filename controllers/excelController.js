const XLSX = require('xlsx');
const fs = require('fs');
const { QueryTypes } = require('sequelize');
const sequelize = require('../config/db');
const ExcelData = require('../models/ExcelData');
const { Op } = require('sequelize');
const DashboardConfig = require('../models/dashboardConfig');


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
    const { rows, value, operation, filtration, drilldown, chartType } = req.body;

    if (!rows || !value || !operation) {
      return res.status(400).send({
        header: { code: 400 },
        body: { value: null, error: 'Parameters "rows", "value", and "operation" are required' }
      });
    }

    let filtrationArray = {};
    if (Array.isArray(filtration)) {
      for (let column of filtration) {
        const trimmedColumn = column.trim();

        const columnExistsQuery = `SHOW COLUMNS FROM excel_data LIKE ?`;
        const columnExistsResult = await sequelize.query(columnExistsQuery, {
          replacements: [trimmedColumn],
          type: QueryTypes.SELECT,
        });

        if (columnExistsResult.length === 0) {
          return res.status(400).send({
            header: { code: 400 },
            body: { value: null, error: `Column '${trimmedColumn}' does not exist in the table` }
          });
        }

        const filtrationQuery = `SELECT DISTINCT ${trimmedColumn} FROM excel_data`;
        const filtrationResult = await sequelize.query(filtrationQuery, {
          type: QueryTypes.SELECT,
        });

        filtrationArray[trimmedColumn] = filtrationResult.map(row => row[trimmedColumn]);
      }
    }

    await DashboardConfig.create({
      x_axis: rows,
      y_axis: value,
      operation,
      filtration: JSON.stringify(filtrationArray),
      drilldown: JSON.stringify(drilldown),
      chartType,
      created_at: new Date()
    });

    res.status(200).send({
      header: {
        code: 600
      },
      body: {
        value: 'Data insertion successful',
        error: null
      }
    });
  } catch (error) {
    console.error('Error inserting data:', error);
    res.status(500).send({
      header: { code: 500 },
      body: { value: null, error: 'Error inserting data' }
    });
  }
};

exports.viewDetails = async (req, res) => {
  try {
    const { fieldname, fieldvalue, page = 1, limit = 10 } = req.query;

    if (!fieldname || !fieldvalue) {
      return res.status(400).json({ message: "Both fieldname and fieldvalue are required." });
    }

    if (typeof fieldname !== 'string' || fieldname.trim() === '') {
      return res.status(400).json({ message: "fieldname must be a valid string." });
    }

    const offset = (page - 1) * limit; // Calculate offset based on the page and limit

    const query = `SELECT * FROM excel_data WHERE \`${fieldname}\` = ? LIMIT ? OFFSET ?`;
    const values = [fieldvalue, parseInt(limit), offset];

    const results = await sequelize.query(query, {
      replacements: values,
      type: QueryTypes.SELECT,
    });

    if (!results || results.length === 0) {
      return res.status(404).json({ message: "No records found for the specified criteria." });
    }

    const countQuery = `SELECT COUNT(*) AS totalCount FROM excel_data WHERE \`${fieldname}\` = ?`;
    const [countResult] = await sequelize.query(countQuery, {
      replacements: [fieldvalue],
      type: QueryTypes.SELECT,
    });
    const totalCount = countResult.totalCount;

    res.status(200).json({
      totalRecords: totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: parseInt(page),
      records: results,  // Ensures 'records' is an array of results
    });
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({ message: "An error occurred while fetching data.", error: error.message });
  }
};

exports.createDrilldownChart = async (req, res) => {
  const { drilldownvalue, rows, values, fieldvalue, operator } = req.body;
  console.log('Request Body:', { drilldownvalue, rows, values, fieldvalue, operator });

  try {
    if (!drilldownvalue || !rows || !values || !fieldvalue || !operator) {
      return res.status(400).json({ error: 'All parameters (drilldownvalue, rows, values, fieldvalue, operator) are required.' });
    }

    let aggregationFunction;
    switch (operator.toUpperCase()) {
      case 'SUM':
        aggregationFunction = sequelize.fn('SUM', sequelize.col(values));
        break;
      case 'COUNT':
        aggregationFunction = sequelize.fn('COUNT', sequelize.col(values));
        break;
      case 'MAX':
        aggregationFunction = sequelize.fn('MAX', sequelize.col(values));
        break;
      case 'MIN':
        aggregationFunction = sequelize.fn('MIN', sequelize.col(values));
        break;
      case 'AVG':
        aggregationFunction = sequelize.fn('AVG', sequelize.col(values));
        break;
      default:
        return res.status(400).json({ error: 'Invalid operator. Use one of: SUM, COUNT, MAX, MIN, AVG.' });
    }

    const data = await ExcelData.findAll({
      attributes: [
        [sequelize.col(drilldownvalue), 'SalesAgent'],
        [aggregationFunction, 'aggregatedValue']
      ],
      where: {
        [rows]: fieldvalue
      },
      group: [drilldownvalue]
    });

    console.log('Query Result:', data);

    const aggregatedResponse = {};
    data.forEach(item => {
      aggregatedResponse[item.get('SalesAgent') || 'Unknown'] = item.get('aggregatedValue');
    });

    const response = {
      header: { code: 600 },
      body: { value: { chart: [aggregatedResponse] } }
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.fetchDetails = async (req, res) => {
  try {
    const { linkchart, linkchartvalue, startDate, endDate, dateRange, id, selectedFiltration } = req.body;

    const configs = await DashboardConfig.findAll();
    let chartResults = [];

    for (let i = 0; i < configs.length; i++) {
      const config = configs[i];
      const configId = config.id;

      if (id && configId !== id) continue;

      const x_axis = config.x_axis;
      const y_axis = config.y_axis;
      const operation = config.operation;
      const chartType = config.chartType;
      const drilldown = JSON.parse(config.drilldown || '[]');

      // Parse filtration from the database configuration
      const dbFiltration = JSON.parse(config.filtration || '{}');

      // Only use the selectedFiltration from the request if provided; otherwise, fall back to the database filtration
      const filtration = selectedFiltration && selectedFiltration.length > 0 ? {} : dbFiltration;

      let whereClause = buildWhereClause(
        filtration, 
        startDate, 
        endDate, 
        dateRange, 
        selectedFiltration
      );

      // Apply linkchart condition if it’s not the first config and values are provided
      if (i !== 0 && linkchart && linkchartvalue) {
        whereClause += whereClause ? ` AND ${linkchart} = '${linkchartvalue}'` : `WHERE ${linkchart} = '${linkchartvalue}'`;
      }

      const chartQuery = `
        SELECT ${x_axis}, ${operation.toUpperCase()}(${y_axis}) AS calculatedValue
        FROM excel_data
        ${whereClause}
        GROUP BY ${x_axis}
      `;

      let filtrationArray = {};
      if (Object.keys(dbFiltration).length > 0) {
        for (const column in dbFiltration) {
          const trimmedColumn = column.trim();

          const columnExistsQuery = `SHOW COLUMNS FROM excel_data LIKE ?`;
          const columnExistsResult = await sequelize.query(columnExistsQuery, {
            replacements: [trimmedColumn],
            type: QueryTypes.SELECT,
          });

          if (columnExistsResult.length === 0) {
            return res.status(400).send({
              header: { code: 400 },
              body: { value: null, error: `Column '${trimmedColumn}' does not exist in the table` },
            });
          }

          const filtrationQuery = `SELECT DISTINCT ${trimmedColumn} FROM excel_data`;
          const filtrationResult = await sequelize.query(filtrationQuery, {
            type: QueryTypes.SELECT,
          });

          filtrationArray[trimmedColumn] = filtrationResult.map(row => row[trimmedColumn]);
        }
      }

      const queryResult = await sequelize.query(chartQuery, { type: QueryTypes.SELECT });

      const chartData = {};
      queryResult.forEach(row => {
        chartData[row[x_axis]] = row.calculatedValue;
      });

      chartResults.push({
        id: configId,
        chart: [chartData],
        filtration: filtrationArray,
        drilldown,
        rows: x_axis,
        operation: operation.toUpperCase(),
        values: y_axis,
        chartType: chartType
      });
    }

    res.status(200).send({
      header: { code: 600 },
      body: {
        value: chartResults,
        error: null
      }
    });
  } catch (error) {
    res.status(500).send({
      header: { code: 500 },
      body: { value: null, error: error.message },
    });
  }
};


function buildFiltrationClause(filtration = {}, selectedFiltration = []) {
  const conditions = [];

  if (filtration && Object.keys(filtration).length) {
    for (const [column, values] of Object.entries(filtration)) {
      if (values.includes(null)) {
        conditions.push(`(${column} IN (${values.filter(v => v !== null).map(val => `'${val}'`).join(', ')}) OR ${column} IS NULL)`);
      } else {
        conditions.push(`${column} IN (${values.map(val => `'${val}'`).join(', ')})`);
      }
    }
  }

  if (selectedFiltration && selectedFiltration.length > 0) {
    selectedFiltration.forEach(filter => {
      const { column, values } = filter;
      if (values.includes(null)) {
        conditions.push(`(${column} IN (${values.filter(v => v !== null).map(val => `'${val}'`).join(', ')}) OR ${column} IS NULL)`);
      } else {
        conditions.push(`${column} IN (${values.map(val => `'${val}'`).join(', ')})`);
      }
    });
  }

  return conditions.join(' AND ');
}

function buildDateClause(startDate, endDate, dateRange) {
  if (startDate && endDate) {
    return `SaleDate BETWEEN '${startDate}' AND '${endDate}'`;
  } else if (dateRange) {
    const { startDate: rangeStart, endDate: rangeEnd } = getDateRange(dateRange);
    if (rangeStart && rangeEnd) {
      return `SaleDate BETWEEN '${rangeStart}' AND '${rangeEnd}'`;
    }
  }
  return '';
}

function buildWhereClause(filtration = {}, startDate, endDate, dateRange, selectedFiltration = []) {
  const filtrationClause = buildFiltrationClause(filtration, selectedFiltration);
  const dateClause = buildDateClause(startDate, endDate, dateRange);

  const conditions = [];
  if (filtrationClause) conditions.push(filtrationClause);
  if (dateClause) conditions.push(dateClause);

  return conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
}




function getDateRange(dateRange) {
  const today = new Date();
  let startDate, endDate;

  switch (dateRange) {
    case 'this_month':
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      break;
    case 'last_month':
      startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      endDate = new Date(today.getFullYear(), today.getMonth(), 0);
      break;
    case 'today':
      startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      endDate = startDate;
      break;
    default:
      return {};
  }

  const formatDate = (date) => {
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
  };
}


// exports.createDashboard = async (req, res) => {
//   try {
//     const { rows, value, operation, startDate, endDate, dateRange, filtration, selectedFiltration, drilldown, chartType } = req.body;

//     if (!rows || !value || !operation) {
//       return res.status(400).send({
//         header: { code: 400 },
//         body: { value: null, error: 'Parameters "rows", "value", and "operation" are required' }
//       });
//     }

//     const allowedOperations = ['COUNT', 'AVG', 'SUM', 'MIN', 'MAX'];
//     if (!allowedOperations.includes(operation.toUpperCase())) {
//       return res.status(400).send({
//         header: { code: 400 },
//         body: { value: null, error: `Invalid operation. Allowed operations are: ${allowedOperations.join(', ')}` }
//       });
//     }

//     let calculatedStartDate = startDate ? new Date(startDate) : null;
//     let calculatedEndDate = endDate ? new Date(endDate) : null;
//     const currentDate = new Date();

//     if (!calculatedStartDate && !calculatedEndDate) {
//       switch (dateRange) {
//         case 'today':
//           calculatedStartDate = new Date(currentDate);
//           calculatedEndDate = new Date(currentDate);
//           break;
//         case 'this_month':
//           calculatedStartDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
//           calculatedEndDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
//           break;
//         case 'last_month':
//           calculatedStartDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
//           calculatedEndDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0);
//           break;
//       }
//     }

//     const formatDateToMMDDYYYY = (date) => {
//       if (!date) return null;
//       const month = String(date.getMonth() + 1).padStart(2, '0');
//       const day = String(date.getDate()).padStart(2, '0');
//       const year = date.getFullYear();
//       return `${month}/${day}/${year}`;
//     };

//     const formattedStartDate = formatDateToMMDDYYYY(calculatedStartDate);
//     const formattedEndDate = formatDateToMMDDYYYY(calculatedEndDate);

//     let dateCondition = '';
//     if (formattedStartDate && formattedEndDate) {
//       dateCondition = `SaleDate BETWEEN :startDate AND :endDate`;
//     } else if (formattedStartDate) {
//       dateCondition = `SaleDate >= :startDate`;
//     } else if (formattedEndDate) {
//       dateCondition = `SaleDate <= :endDate`;
//     }

//     let filterConditions = '';
//     if (selectedFiltration && Array.isArray(selectedFiltration)) {
//       selectedFiltration.forEach(filter => {
//         const column = filter.column;
//         const values = filter.values;

//         if (Array.isArray(values)) {
//           const valueList = values.map(value => `'${value}'`).join(", ");
//           filterConditions += ` AND ${column} IN (${valueList})`;
//         } else {
//           filterConditions += ` AND ${column} = '${values}'`;
//         }
//       });
//     }

//     let whereClause = '';
//     if (dateCondition || filterConditions) {
//       whereClause = `WHERE ${dateCondition}`;
//       if (filterConditions) {
//         whereClause += `${dateCondition ? '' : '1=1'} ${filterConditions}`;
//       }
//     }

//     const chartQuery = `
//       SELECT ${rows}, ${operation.toUpperCase()}(${value}) AS calculatedValue
//       FROM excel_data
//       ${whereClause}
//       GROUP BY ${rows}
//     `;
//     const chartResult = await sequelize.query(chartQuery, {
//       replacements: { startDate: formattedStartDate, endDate: formattedEndDate },
//       type: QueryTypes.SELECT,
//     });

//     const valueObject = {};
//     chartResult.forEach(row => {
//       valueObject[row[rows]] = row.calculatedValue;
//     });

//     let filtrationArray = {};
//     if (Array.isArray(filtration)) {
//       for (let column of filtration) {
//         const trimmedColumn = column.trim();

//         const columnExistsQuery = `SHOW COLUMNS FROM excel_data LIKE ?`;
//         const columnExistsResult = await sequelize.query(columnExistsQuery, {
//           replacements: [trimmedColumn],
//           type: QueryTypes.SELECT,
//         });

//         if (columnExistsResult.length === 0) {
//           return res.status(400).send({
//             header: { code: 400 },
//             body: { value: null, error: `Column '${trimmedColumn}' does not exist in the table` }
//           });
//         }

//         const filtrationQuery = `SELECT DISTINCT ${trimmedColumn} FROM excel_data`;
//         const filtrationResult = await sequelize.query(filtrationQuery, {
//           type: QueryTypes.SELECT,
//         });

//         filtrationArray[trimmedColumn] = filtrationResult.map(row => row[trimmedColumn]);
//       }
//     }

//     await DashboardConfig.create({
//       x_axis: rows,
//       y_axis: value,
//       operation,
//       filtration: JSON.stringify(filtrationArray),
//       drilldown: JSON.stringify(drilldown),
//       chartType,
//       created_at: new Date()
//     });

//     const response = {
//       header: {
//         code: 600
//       },
//       body: {
//         value: {
//           chart: [valueObject],
//           filtration: filtrationArray,
//           drilldown: drilldown,
//           rows,
//           operation,
//           chartType,
//           values: value
//         },
//         error: null
//       }
//     };

//     res.status(200).send(response);
//   } catch (error) {
//     console.error('Error fetching data:', error);
//     res.status(500).send({
//       header: { code: 500 },
//       body: { value: null, error: 'Error fetching data' }
//     });
//   }
// };













































