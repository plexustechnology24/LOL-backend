const express = require('express');
const router = express.Router();
const premiumControllers = require('../controllers/premium');


router.post('/create', premiumControllers.Create);

router.post('/read', premiumControllers.Read);

router.patch('/update/:id', premiumControllers.Update);

router.delete('/delete/:id', premiumControllers.Delete);


module.exports = router;
