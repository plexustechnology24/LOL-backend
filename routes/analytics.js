const express = require('express');
const router = express.Router();
const AnalyticsControllers = require('../controllers/analytics');
const { validateRequestBody } = require('../middleware/validateRequest');


const app = express();
app.set('views', './views')
app.set('view engine', 'hbs')


// ===================== Story Collabration ===========================
router.post('/web', validateRequestBody, AnalyticsControllers.Web);

router.post('/demo', validateRequestBody, AnalyticsControllers.Demo);

router.post('/web/create', validateRequestBody, AnalyticsControllers.WebCreate);

router.patch('/web/update/:id', validateRequestBody, AnalyticsControllers.WebUpdate);

router.delete('/web/delete/:id', validateRequestBody, AnalyticsControllers.DeleteWeb);

// ======================= Video Collabration =====================

router.post('/create', validateRequestBody, AnalyticsControllers.DeepLinkCreate);

router.post('/read', validateRequestBody , AnalyticsControllers.DeepLinkRead);

router.patch('/update/:id', validateRequestBody , AnalyticsControllers.DeepLinkUpdate);

router.delete('/delete/:id', validateRequestBody , AnalyticsControllers.DeepLinkDelete);

router.post('/deeplink', validateRequestBody , AnalyticsControllers.DeepLink);

router.post('/install', validateRequestBody , AnalyticsControllers.Install);


module.exports = router;