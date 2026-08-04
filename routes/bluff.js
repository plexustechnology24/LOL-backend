const bluffControllers = require('../controllers/bluff');
const Bluff = require('../models/bluffCardBg');
const createCardBgRouter = require('../utils/cardBgRouterFactory');

module.exports = createCardBgRouter({
    controller: bluffControllers,
    model: Bluff,
    folderPath: 'images/question9/CardBg',
    allowSvg: false
});