const express = require('express');
const router = express.Router();
const deviceControllers = require('../controllers/device');


router.post('/create', deviceControllers.Create);

router.post('/read', deviceControllers.Read);

router.patch('/update/:id', deviceControllers.Update);

router.delete('/delete/:id', deviceControllers.Delete);

router.delete('/deletedata', deviceControllers.DeleteData);


module.exports = router;
