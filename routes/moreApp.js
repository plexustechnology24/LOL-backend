var express = require('express');
var router = express.Router();
const moreAppControllers = require('../controllers/moreApp')
const multer = require('multer')

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './public/images/MoreApp')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + file.originalname)
  }
})

const upload = multer({ storage: storage })

/* GET service listing. */
router.post('/create', upload.single('logo'), moreAppControllers.Create);

router.post('/read', moreAppControllers.Read);

router.post('',  upload.none(),moreAppControllers.Found);

router.patch('/update/:id', upload.single('logo'),moreAppControllers.Update);

router.delete('/delete/:id', moreAppControllers.Delete);





module.exports = router;