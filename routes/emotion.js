const express = require('express');
const router = express.Router();
const emotionControllers = require('../controllers/emotion');
const CardBg = require('../models/emotionCardBg');
const Emoji = require('../models/emotionEmoji');
const createCardBgRouter = require('../utils/cardBgRouterFactory');

router.use(createCardBgRouter({
    controller: { Create: emotionControllers.Create, Read: emotionControllers.Read, Update: emotionControllers.Update, Delete: emotionControllers.Delete },
    model: CardBg,
    folderPath: 'images/question4/CardBg',
    routePrefix: '/cardbg',
    allowSvg: true
}));

router.use(createCardBgRouter({
    controller: { Create: emotionControllers.EmojiCreate, Read: emotionControllers.EmojiRead, Update: emotionControllers.EmojiUpdate, Delete: emotionControllers.EmojiDelete },
    model: Emoji,
    fieldName: 'Emoji',
    folderPath: 'images/question4/Emoji',
    routePrefix: '/emoji',
    allowSvg: true
}));

module.exports = router;