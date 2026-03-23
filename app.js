const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');
const passport = require('passport');
const session = require('express-session');
const mongoose = require('mongoose');
const helmet = require('helmet');  // Add helmet
const compression = require('compression');  // Add compression
const rateLimit = require('express-rate-limit');  // Add rate limiting
require('dotenv').config();
const fs = require('fs');

// Import your existing routes
const adminRouter = require('./routes/admin');
const moreAppRouter = require('./routes/moreApp');
const userRouter = require('./routes/user');
const notificationRouter = require('./routes/notification');
const newinboxRouter = require('./routes/inboxnew');
const analyticsRouter = require('./routes/analytics');
const premiumRouter = require('./routes/premium');
const cardbgRouter = require('./routes/cardBg');
const emotionRouter = require('./routes/emotion');
const avatarRouter = require('./routes/avatar');
const deviceRouter = require('./routes/device');
const contentRouter = require('./routes/content');
const hotnessRouter = require('./routes/hotness');
const friendRouter = require('./routes/friend');
const bluffRouter = require('./routes/bluff');
const heavenHellRouter = require('./routes/heavenHell');
const comingSoonRouter = require('./routes/comingSoon');
const challengeRouter = require('./routes/challenge');
const collabRouter = require('./routes/collab');
const tempRouter = require('./routes/temp');
const messageRouter = require('./routes/message');

const app = express();

// Security configurations
app.use(helmet());
app.use(compression());


// MongoDB connection
// const mongoUri = process.env.MONGODB_URI;

// mongoose.connect(mongoUri)
//   .then(() => console.log('Connected to MongoDB!'))
//   .catch((error) => console.error('MongoDB connection error:', error.message));

// Memory monitoring middleware
app.use((req, res, next) => {
  const startMemory = process.memoryUsage().heapUsed;
  res.on('finish', () => {
    const endMemory = process.memoryUsage().heapUsed;
    const memoryUsed = (endMemory - startMemory) / 1024 / 1024; // Convert to MB
    if (memoryUsed > 50) { // Alert if single request uses more than 50MB
      console.warn(`High memory usage (${memoryUsed.toFixed(2)}MB) on ${req.method} ${req.url}`);
    }
  });
  next();
});


// Request timeout middleware
app.use((req, res, next) => {
  res.setTimeout(40000, () => {
    if (!res.headersSent) {
      res.status(408).json({ status: 0, message: "Request Timeout" });
    }
  });
  next();
});

// Cache control middleware
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  next();
});

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(cors());

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Basic middleware
app.use(logger('dev'));
app.use(express.json({ limit: '50mb' }));  
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  res.on('finish', () => {
    console.log(`Response Status: ${res.statusCode}`);
  });
  next();
});

// Route handling
app.use('/api/admin', adminRouter);
app.use('/api/moreapp', moreAppRouter);
app.use('/api/', userRouter);
app.use('/api/notification', notificationRouter);
app.use('/api/newinbox', newinboxRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/premium', premiumRouter);
app.use('/api/cardbg', cardbgRouter);
app.use('/api/avatar', avatarRouter);
app.use('/api/emotion', emotionRouter);
app.use('/api/device', deviceRouter);
app.use('/api/hintcontent', contentRouter);
app.use('/api/hotness', hotnessRouter);
app.use('/api/friend', friendRouter);
app.use('/api/bluff', bluffRouter);
app.use('/api/heaven-hell', heavenHellRouter);
app.use('/api/coming-soon', comingSoonRouter);
app.use('/api/challenge', challengeRouter);
app.use('/api/collab', collabRouter);
app.use('/api/temp', tempRouter);
app.use('/api/message', messageRouter);

app.get("/", (req, res) => {
  res.send("Server is running!");
});

const wellKnownDir = path.join(__dirname, 'public', '.well-known');
const filePath = path.join(wellKnownDir, 'apple-app-site-association');

app.get('/.well-known/apple-app-site-association', (req, res) => {
  // read the file (ensure it's saved without BOM and without .json extension)
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('AASA read error:', err);
      return res.status(500).send('Not found');
    }
    // set exact content-type
    res.set('Content-Type', 'application/json');
    // optional: prevent caching while testing
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.send(data);
  });
});

const port = process.env.PORT || 3000;
console.log(`Server running on port ${port}`);

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    status: 0,
    message: "Not Found"
  });
});

// Error handler
app.use(function(err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  console.error(err);  // Log errors
  res.status(err.status || 500);
  res.render('error');
});

process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('MongoDB connection closed due to app termination');
  process.exit(0);
});
 

module.exports = app;