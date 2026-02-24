const mongoose = require('mongoose');
const { connection1 } = require('../db');

const Schema = mongoose.Schema;

const cardBgData = new Schema({
    CardBg : String
},
    {
        versionKey: false,
        timestamps: true
    });


module.exports = connection1.models.cardBg || connection1.model('cardBg', cardBgData)
