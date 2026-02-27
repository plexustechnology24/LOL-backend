const mongoose = require('mongoose');
const { connection1 } = require('../db');

const Schema = mongoose.Schema;

const heavenHellcardBgData = new Schema({
    CardBg: String,
    Category : String
},
    {
        versionKey: false,
        timestamps: true
    });

module.exports = connection1.models['heavenHell-cardBg'] || connection1.model('heavenHell-cardBg', heavenHellcardBgData);
