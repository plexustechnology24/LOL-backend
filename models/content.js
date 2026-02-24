const mongoose = require('mongoose');
const { connection1 } = require('../db');

const Schema = mongoose.Schema;

const hintContentData = new Schema({
    Content: String,
    hiContent: String,
    esContent: String
},
    {
        versionKey: false,
        timestamps: true
    });

module.exports = connection1.models['hint-content'] || connection1.model('hint-content', hintContentData);
