const express = require('express');
const router = express.Router();
const heavenHellControllers = require('../controllers/heavenHell');
const HeavenHell = require('../models/heavenHellCardBg');
const createCardBgRouter = require('../utils/cardBgRouterFactory');

// CardBg routes: /create, /read, /update/:id, /delete/:id
router.use(createCardBgRouter({
    controller: heavenHellControllers,
    model: HeavenHell,
    folderPath: 'images/question11/CardBg',
    allowSvg: false
}));

// ============================== Content =====================================
router.post('/content/create', heavenHellControllers.ContentCreate);
router.post('/content/read', heavenHellControllers.ContentRead);
router.patch('/content/update/:id', heavenHellControllers.ContentUpdate);
router.delete('/content/delete/:id', heavenHellControllers.ContentDelete);

module.exports = router;