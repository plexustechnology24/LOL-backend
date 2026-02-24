const express = require('express');
const router = express.Router();
const notificationControllers = require('../controllers/notification');


router.post('/create', notificationControllers.Create);

router.post('/read', notificationControllers.Read);

router.patch('/update/:id', notificationControllers.Update);

router.delete('/delete/:id', notificationControllers.Delete);


module.exports = router;
