const mongoose = require('mongoose');
const { connection1 } = require('../db');

const Schema = mongoose.Schema;

const ques12ContentData = new Schema({
    Category: String,
    Content: String,
    hiContent: String,
    taContent: String,
    mrContent: String,
    enhiContent: String
},
    {
        versionKey: false,
        timestamps: true
    });

module.exports = connection1.models['ques12-content'] || connection1.model('ques12-content', ques12ContentData);
