const mongoose = require('mongoose');
const { connection1 } = require('../db');

const Schema = mongoose.Schema;

const comingSoonSuggestionData = new Schema({
    suggestions: String,
},
    {
        versionKey: false,
        timestamps: true
    });


module.exports = connection1.models['coming-soon-suggestions'] || connection1.model('coming-soon-suggestions', comingSoonSuggestionData);
