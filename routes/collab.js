var express = require('express');
var router = express.Router();
const collabControllers = require('../controllers/collab')
const multer = require('multer')
const { verifyUserEmail, verifyToken, verifyUserId, validateRequestBody } = require('../middleware/validateRequest');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './public/images')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + file.originalname)
  }
})

const upload = multer({ storage: storage })

/* GET service listing. */
router.post('/add', upload.none(), validateRequestBody, verifyToken, verifyUserId, collabControllers.Create);

router.post('/web/add', upload.none(), collabControllers.Create2);

router.post('/read', collabControllers.Read);

router.put('/update/:id', upload.none(), collabControllers.Update);

router.delete('/delete/:id', collabControllers.Delete);

router.get('/unread-count', collabControllers.Unread);


module.exports = router;