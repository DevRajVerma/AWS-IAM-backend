const mongoose = require("mongoose");

const connnectDB = async () => {
  try {

    const conn = await mongoose.connect(process.env.MONGODB_URI);
    
  } catch (err) {
    
    process.exit(1); //Exit the process if DB connection fails
  }
};


module.exports = connnectDB;