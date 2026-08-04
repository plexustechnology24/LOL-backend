const friendCategory = require('../controllers/friend');
const FriendCardBg = require('../models/friendCardBg');
const createCardBgRouter = require('../utils/cardBgRouterFactory');

module.exports = createCardBgRouter({
    controller: friendCategory,
    model: FriendCardBg,
    folderPath: 'images/question7/CardBg',
    routePrefix: '/cardbg',
    allowSvg: true
});