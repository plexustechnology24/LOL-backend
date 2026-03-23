const mongoose = require('mongoose');
const { connection1 } = require('../db');

const Schema = mongoose.Schema;

const heavenHellContentData = new Schema({
    Category: String,
    Content: String,
    hiContent: String,
    esContent: String
},
    {
        versionKey: false,
        timestamps: true
    });

module.exports = connection1.models['heavenHell-content'] || connection1.model('heavenHell-content', heavenHellContentData);
