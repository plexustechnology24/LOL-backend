const mongoose = require('mongoose');
const { connection1 } = require('../db');

const Schema = mongoose.Schema;

const ques4EmojiData = new Schema({
    Emoji: String,
    Category : String
},
    {
        versionKey: false,
        timestamps: true
    });

module.exports = connection1.models['ques4-emoji'] || connection1.model('ques4-emoji', ques4EmojiData);
