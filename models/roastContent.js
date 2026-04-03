const mongoose = require('mongoose');
const { connection1 } = require('../db');

const Schema = mongoose.Schema;

const ques8ContentData = new Schema({
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

module.exports = connection1.models['ques8-content'] || connection1.model('ques8-content', ques8ContentData);
