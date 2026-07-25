const mongoose = require('mongoose');
const { connection1 } = require('../db');

const Schema = mongoose.Schema;

const ques13ContentData = new Schema({
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

module.exports = connection1.models['ques13-content'] || connection1.model('ques13-content', ques13ContentData);
