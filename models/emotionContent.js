const mongoose = require('mongoose');
const { connection1 } = require('../db');

const Schema = mongoose.Schema;

const ques4ContentData = new Schema({
    Category: String,
    Content: String,
    hiContent: String,
    esContent: String
},
    {
        versionKey: false,
        timestamps: true
    });

module.exports = connection1.models['ques4-content'] || connection1.model('ques4-content', ques4ContentData);
