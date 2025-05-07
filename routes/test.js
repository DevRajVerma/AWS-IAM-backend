const express = require("express");
const router = express.Router();
const { authenticate, isAdmin } = require("../middlewares/auth");

router.get("/protected", authenticate, (req,res) => {
    res.send(`Hello ${req.user.email}, you are authenticated!`);
})

router.get("/admin", authenticate, isAdmin, (req,res)=>{
    res.send("Welcome Admin!");
});

module.exports = router;