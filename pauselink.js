const axios = require('axios');
const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB URI
const mongoUri = "mongodb+srv://loladmin:sPuNLyNN43P9kvJJ@lol.xtafe5q.mongodb.net/LOL";

// Connect to MongoDB
mongoose.connect(mongoUri)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.log('❌ Failed to connect to MongoDB', err));

// Define Notification schema
const Schema = mongoose.Schema;
const newuserData = new Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  birthdate: String,
  name: String,
  avatar: {
    type: String,
    required: true
  },
  username: {
    type: String
  },
  isPurchase: {
    type: Boolean,
    enum: ['true', 'false'],
    default: 'false',
    required: true
  },
  purchaseId: { type: String, default: null },
  transactionId: { type: String, default: null },
  subscriptionId: { type: String, default: null },
  link: {
    type: String
  },
  pauseLink: {
    type: Boolean,
    enum: ['true', 'false'],
    default: 'false',
    required: true
  },
  expiryTime: Number,
  timeperiod: Number,
  language: {
    type: String
  },
  deviceToken: [String],
  deviceId: [String],
  picroastcredit: {
    type: Number,
    default: 2,
    min: 0,
    max: 2
  },
  question: [
    {
      category: String,
      question: String,
      answer: {
        word: String, //1
        image: String, //2
        timestamp: Number, //2
        quetype: String, //2
        thumbnailUrl: String, //2
        annoycardtitle: [Number], //3
        speakWord: String,  //4
        confessionTitle: String,  //5
      },
      lan: String
    }
  ],
  annoyallcardtitle: [String],
  blockList: [{
    type: String
  }],
},
  { timestamps: true });

const USER = mongoose.models['newuser'] || mongoose.model('newuser', newuserData);


// Main execution
const main = async () => {
  try {
    const now = Date.now();

    // Find users whose pauseLink is true but expired
    const expiredUsers = await USER.find({
      pauseLink: true,
      expiryTime: { $lte: now }
    });

    for (let user of expiredUsers) {
      user.pauseLink = false;
      user.expiryTime = null;
      user.timeperiod = -1;
      await user.save();
      console.log(`✅ pauseLink reset for user ${user.id}`);
    }

  } catch (error) {
    console.error('❌ Main process error:', error);
  } finally {
    console.log('\n🏁 Process completed');
    process.exit(0);
  }
};

// Run the script
main();