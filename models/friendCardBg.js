const mongoose = require('mongoose');
const { connection1 } = require('../db');

const Schema = mongoose.Schema;

const cardBgData = new Schema({
    CardBg: String,
},
    {
        versionKey: false,
        timestamps: true
    });


module.exports = connection1.models['que7-cardbg'] || connection1.model('que7-cardbg', cardBgData);
