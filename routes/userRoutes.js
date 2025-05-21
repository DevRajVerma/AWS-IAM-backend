const express = require("express");

const router = express.Router();

const {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  updateLastLogin,
} = require("../controllers/userController");

const { protect, admin } = require("../middlewares/authMiddleware");

//Get all users
router.get("/", protect, admin, getUsers);

//Get user by ID
router.get("/:id", protect, admin, getUserById);


//Create a new user
router.post("/", protect, admin, createUser);

//Update user
router.put("/:id", protect, admin, updateUser);

//Delete user
router.delete("/:id", protect, admin, deleteUser);

//Update last login
router.put("/:id/login", protect, updateLastLogin);

module.exports = router;

