const mongoose = require('mongoose');
const { connection1 } = require('../db');

const Schema = mongoose.Schema;

const ques10ContentData = new Schema({
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

module.exports = connection1.models['ques10-content'] || connection1.model('ques10-content', ques10ContentData);
