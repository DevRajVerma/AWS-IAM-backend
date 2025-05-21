const express = require("express");
const router = express.Router();
const {
  signup,
  login,
  getUserProfile,
  updateUserProfile,
} = require("../controllers/authController");

const { protect } = require("../middlewares/authMiddleware");
//idhar signup aur login ka logic import kiya controller mein jo pada hai

router.post("/signup", signup);
router.post("/login", login);
router.get("/profile", protect, getUserProfile);
router.put("/profile", protect, updateUserProfile);

module.exports = router;
