const mongoose = require('mongoose');
const { connection1 } = require('../db');

const Schema = mongoose.Schema;

const reputationcardBgData = new Schema({
    CardBg: String
},
    {
        versionKey: false,
        timestamps: true
    });

module.exports = connection1.models['reputation-cardBg'] || connection1.model('reputation-cardBg', reputationcardBgData);
