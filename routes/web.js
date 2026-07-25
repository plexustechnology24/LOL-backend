var express = require('express');
var router = express.Router();
const webControllers = require('../controllers/web');
const { validateRequestBody } = require('../middleware/validateRequest');


router.post('/view/count', webControllers.Create);

router.post('/content', webControllers.WebCardContent);

router.post('/cardpreview', validateRequestBody, webControllers.WebCardPreview);
router.post('/emotion/cardpreview', validateRequestBody, webControllers.WebEmotionCardPreview);
router.post('/common/cardpreview', validateRequestBody, webControllers.WebCommonCardPreview);

router.post('/hotness', validateRequestBody, webControllers.WebRoastHostId);

router.post('/catgory/found',  validateRequestBody, webControllers.CategoryWeb);

router.post('/catgory/webinstall', validateRequestBody, webControllers.WebInstall);

router.post('/catgory/ip', validateRequestBody, webControllers.CategoryWebIp);

module.exports = router;