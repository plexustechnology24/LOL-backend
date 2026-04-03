const mongoose = require('mongoose');
const { connection1 } = require('../db');

const Schema = mongoose.Schema;

const hotnessCategory = new Schema({
    categoryId: Number,
    categoryTitle: String,          // Default English
    hicategoryTitle: String,        // Hindi
    escategoryTitle: String,        // Spanish
    tacategoryTitle: String,        // Tamil
    mrcategoryTitle: String,        // Marathi
    enhicategoryTitle: String,      // Hinglish (Roman Hindi)
    categoryImage: String,
    subCatergoryTitle: String,      // Default English
    hisubCatergoryTitle: String,    // Hindi
    essubCatergoryTitle: String,    // Spanish
    tasubCatergoryTitle: String,    // Tamil
    mrsubCatergoryTitle: String,    // Marathi
    enhisubCatergoryTitle: String,  // Hinglish (Roman Hindi)
    subCatergoryImage: String,
    cardImage: String
},
    {
        versionKey: false,
        timestamps: true
    });


module.exports = connection1.models['hotness-category'] || connection1.model('hotness-category', hotnessCategory);
