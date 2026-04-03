var express = require('express');
var router = express.Router();
const webControllers = require('../controllers/web')


router.post('/view/count', webControllers.Create);


module.exports = router;