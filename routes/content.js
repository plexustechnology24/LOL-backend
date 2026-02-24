const express = require('express');
const router = express.Router();
const emotionControllers = require('../controllers/content');


// ============================== Content =====================================
router.post('/create', emotionControllers.ContentCreate);

router.post('/read', emotionControllers.ContentRead);

router.patch('/update/:id', emotionControllers.ContentUpdate);

router.delete('/delete/:id', emotionControllers.ContentDelete);

module.exports = router;
