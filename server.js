const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const cors = require("cors");

dotenv.config();
const app = express();
app.use(express.json());

app.use(cors());

//connection to database
connectDB();

//Use Routes
const authRoutes = require("./routes/auth"); //routes ko import kiya
const testRoutes = require("./routes/test");
const userRoutes = require("./routes/userRoutes");


//Use Routes
app.use("/api/auth", authRoutes); //middleware use kiya
app.use("/api/test", testRoutes);
app.use("/api/users", userRoutes );


// Error handler middleware
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);
  res.json({
    message: err.message,
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
