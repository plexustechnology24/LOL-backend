const cardBgControllers = require('../controllers/cardBg');
const CardBg = require('../models/cardBg');
const createCardBgRouter = require('../utils/cardBgRouterFactory');

module.exports = createCardBgRouter({
    controller: cardBgControllers,
    model: CardBg,
    folderPath: 'images/CardBg',
    allowSvg: false
});