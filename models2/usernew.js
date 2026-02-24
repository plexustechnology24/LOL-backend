const mongoose = require('mongoose');
const { connection2 } = require('../db');

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
    update : String,
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
                hotnessId: Number,  //6
                subCategory: String,  //7
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


module.exports = connection2.models.newuser || connection2.model('newuser', newuserData)