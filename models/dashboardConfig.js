const { DataTypes } = require('sequelize');
const sequelize = require('../config/db'); // Adjust path as needed to match your setup

const DashboardConfig = sequelize.define('DashboardConfig', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  x_axis: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  y_axis: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  operation: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  filtration: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  drilldown: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  chartType: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'DashboardConfig', // Use the correct table name in your database
  timestamps: false,
});

module.exports = DashboardConfig;
