const express = require('express');
const cors = require('cors');
const excelRoutes = require('./routes/excelRoutes');
const sequelize = require('./config/db'); // Ensure this line is included

require('dotenv').config(); // Load environment variables from .env

const app = express();

app.use(cors({
  origin: 'http://localhost:3000'
}));

app.use(express.json());
app.use('/', excelRoutes);

const PORT = process.env.PORT || 5000;

// Sync the database and then start the server
sequelize.sync().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}).catch((err) => {
  console.error('Unable to connect to the database:', err);
});
