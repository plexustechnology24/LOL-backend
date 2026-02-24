const mongoose = require('mongoose');
const { connection1 } = require('../db');

const Schema = mongoose.Schema;

const bluffcardBgData = new Schema({
    CardBg: String,
    Category : String
},
    {
        versionKey: false,
        timestamps: true
    });

module.exports = connection1.models['bluff-cardBg'] || connection1.model('bluff-cardBg', bluffcardBgData);
