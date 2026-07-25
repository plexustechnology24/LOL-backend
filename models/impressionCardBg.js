const mongoose = require('mongoose');
const { connection1 } = require('../db');

const Schema = mongoose.Schema;

const impressioncardBgData = new Schema({
    CardBg: String
},
    {
        versionKey: false,
        timestamps: true
    });

module.exports = connection1.models['impression-cardBg'] || connection1.model('impression-cardBg', impressioncardBgData);
