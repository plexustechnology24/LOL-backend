var express = require('express');
var router = express.Router();
const comingSoonControllers = require('../controllers/comingSoon')
const { validateRequestBody, verifyToken, verifyUserId } = require('../middleware/validateRequest');
const multer = require('multer')

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './public/images/comingSoon')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + file.originalname)
  }
})

const upload = multer({ storage: storage })

/* GET service listing. */
router.post('/create', upload.none(''), comingSoonControllers.Create);

router.post('/read', comingSoonControllers.Read);

router.post('/suggestion/read', comingSoonControllers.SuggestionRead);

router.patch('/update/:id', upload.none(''),comingSoonControllers.Update);

router.delete('/delete/:id', comingSoonControllers.Delete);

router.post('/find', upload.none(''), validateRequestBody, verifyToken, verifyUserId, comingSoonControllers.Find);

router.post('/vote/:id', upload.none(''), comingSoonControllers.AddOriginalVote);




module.exports = router;