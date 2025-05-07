const express = require("express");
const router = express.Router();
const { signup, login } = require("../controllers/authController");
const {loda } = require("../controllers/loda");
//idhar signup aur login ka logic import kiya controller mein jo pada hai

router.post("/signup", signup);
router.post("/login",login);
router.get("/loda", loda);

module.exports = router;