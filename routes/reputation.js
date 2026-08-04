const reputationCategory = require('../controllers/reputation');
const ReputationCardBg = require('../models/reputationCardBg');
const createCardBgRouter = require('../utils/cardBgRouterFactory');

module.exports = createCardBgRouter({
    controller: reputationCategory,
    model: ReputationCardBg,
    folderPath: 'images/question12/CardBg',
    routePrefix: '/cardbg',
    allowSvg: true
});