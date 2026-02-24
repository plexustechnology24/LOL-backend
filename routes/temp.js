var express = require('express');
var router = express.Router();
const TempControllers = require('../controllers/temp')


router.post('/add', TempControllers.Create);

router.get('/read', TempControllers.Read);

router.delete('/delete/:id', TempControllers.Delete);



module.exports = router;