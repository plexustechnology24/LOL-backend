const mongoose = require('mongoose');
const { connection1 } = require('../db');

const Schema = mongoose.Schema;

const ques5ContentData = new Schema({
    Category: String,
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

module.exports = connection1.models['ques5-content'] || connection1.model('ques5-content', ques5ContentData);
