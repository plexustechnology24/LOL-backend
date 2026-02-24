const mongoose = require('mongoose');
const { connection1 } = require('../db');

const Schema = mongoose.Schema;

const ques4cardBgData = new Schema({
    CardBg: String,
    Category : String
},
    {
        versionKey: false,
        timestamps: true
    });

module.exports = connection1.models['ques4-cardBg'] || connection1.model('ques4-cardBg', ques4cardBgData);
