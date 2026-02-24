var express = require('express');
var router = express.Router();
const AdminControllers = require('../controllers/admin')


/* GET Admin listing. */
router.post('/signup', AdminControllers.AdminSignup);

router.post('/login',  AdminControllers.AdminLogin);

router.get('/logout', (req, res) => {
  // Clear session or token (depends on your authentication method)
  req.session.destroy(); // Example for session-based authentication

  // Redirect to the login page or send a success response
  res.json({ message: 'Logged out successfully' });
});


router.get('/read', AdminControllers.AdminRead);

router.patch('/update/:id', AdminControllers.AdminUpdate);

router.post('/category/create', AdminControllers.CategoryCreate);
router.post('/category', AdminControllers.CategoryFind);
router.delete('/category/delete/:id', AdminControllers.CategoryDelete);
router.patch('/monitoring', AdminControllers.Monitoring);

router.post('/deleteMultiple', AdminControllers.UserDeleteMultiple);


router.get('/dashboard', AdminControllers.Dashboard);


module.exports = router;