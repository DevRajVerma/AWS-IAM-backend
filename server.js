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

app.use("/api/auth", authRoutes); //middleware use kiya
app.use("/api/test", testRoutes);

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
