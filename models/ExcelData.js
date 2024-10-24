const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ExcelData = sequelize.define('ExcelData', {
  Project: { type: DataTypes.STRING },
  Building: { type: DataTypes.STRING },
  UNIT_CODE: { type: DataTypes.STRING },
  SaleDate: { type: DataTypes.STRING },
  CustomerName: { type: DataTypes.STRING },
  Area: { type: DataTypes.STRING },
  SALE_VALUE: { type: DataTypes.STRING },
  UNITTYPE: { type: DataTypes.STRING },
  BrokerName: { type: DataTypes.STRING },
  SalesAgent: { type: DataTypes.STRING },
  UNIT_STATUS: { type: DataTypes.STRING },
  UNITSTATUSNew: { type: DataTypes.STRING },
  OQOOD: { type: DataTypes.STRING },
  OQOODDone: { type: DataTypes.STRING },
  InvoicedAmount: { type: DataTypes.STRING },
  DueAmount: { type: DataTypes.STRING },
  Ageing: { type: DataTypes.STRING },
  PaymentPlan: { type: DataTypes.STRING },
  Realised: { type: DataTypes.STRING },
  PDC: { type: DataTypes.STRING },
  TotalCollection: { type: DataTypes.STRING },
}, {
  tableName: 'excel_data',
  timestamps: false,
});

module.exports = ExcelData;
