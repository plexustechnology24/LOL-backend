const jwt = require('jsonwebtoken');
const SECRET_KEY = 'LOL-KEY'; 

// Middleware to check whitespace in keys and trim all string values
exports.validateRequestBody = (req, res, next) => {
  const hasWhitespaceInKey = obj => Object.keys(obj).some(key => /\s/.test(key));

  if (hasWhitespaceInKey(req.body)) {
    return res.status(400).json({
      status: 0,
      message: 'Field names must not contain whitespace.'
    });
  }

  Object.keys(req.body).forEach(key => {
    if (typeof req.body[key] === 'string') {
      req.body[key] = req.body[key].trim();
    }
  });

  next();
};

// Middleware to verify JWT and attach decoded user to req.user
exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      status: 0,
      message: 'Token is required'
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      status: 0,
      message: 'Invalid or expired token'
    });
  }
};

// Middleware to compare decoded token id with req.body.id
exports.verifyUserId = (req, res, next) => {
  if (!req.body.id) {
    return res.status(400).json({ status: 0, message: "id is required" });
  }

  if (req.user.id !== req.body.id) {
    return res.status(403).json({
      status: 0,
      message: 'Token does not match the user'
    });
  }

  next();
};

// Middleware to compare decoded token id with req.body.id
exports.verifyUserEmail = (req, res, next) => {
  if (!req.body.email) {
    return res.status(400).json({ status: 0, message: "email is required" });
  }

  if (req.user.id !== req.body.email) {
    return res.status(403).json({
      status: 0,
      message: 'Token does not match the user'
    });
  }

  next();
};
