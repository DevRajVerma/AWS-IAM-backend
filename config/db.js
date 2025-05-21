const mongoose = require("mongoose");

const connnectDB = async () => {
  try {

    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`Connected to MongoDB: ${conn.connection.host}`);
  } catch (err) {
    console.log("MongoDB connection error:", err);
    process.exit(1); //Exit the process if DB connection fails
  }
};


module.exports = connnectDB;