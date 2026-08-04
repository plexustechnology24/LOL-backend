const impressionCategory = require('../controllers/impression');
const ImpressionCardBg = require('../models/impressionCardBg');
const createCardBgRouter = require('../utils/cardBgRouterFactory');

module.exports = createCardBgRouter({
    controller: impressionCategory,
    model: ImpressionCardBg,
    folderPath: 'images/question13/CardBg',
    routePrefix: '/cardbg',
    allowSvg: true
});