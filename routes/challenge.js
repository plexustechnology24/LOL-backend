const express = require('express');
const router = express.Router();
const challengeControllers = require('../controllers/challenge');

// ============================== Content =====================================
router.post('/content/create', challengeControllers.ContentCreate);

router.post('/content/read', challengeControllers.ContentRead);

router.patch('/content/update/:id', challengeControllers.ContentUpdate);

router.delete('/content/delete/:id', challengeControllers.ContentDelete);

module.exports = router;
