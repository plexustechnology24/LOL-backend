const mongoose = require('mongoose');
const { connection1 } = require('../db');

const Schema = mongoose.Schema;

const heavenHellContentData = new Schema({
    Content: String,
    hiContent: String,
    esContent: String,
    taContent: String,
    mrContent: String,
    enhiContent: String
},
    {
        versionKey: false,
        timestamps: true
    });

module.exports = connection1.models['heavenHell-ques'] || connection1.model('heavenHell-ques', heavenHellContentData);
