const mongoose = require('mongoose');
const { connection1 } = require('../db');

const Schema = mongoose.Schema;

const hotnessCategory = new Schema({
    categoryId: Number,
    categoryTitle: String,
    hicategoryTitle: String,
    escategoryTitle: String,
    categoryImage: String,
    subCatergoryTitle: String,
    hisubCatergoryTitle: String,
    essubCatergoryTitle: String,
    subCatergoryImage: String,
    cardImage: String
},
    {
        versionKey: false,
        timestamps: true
    });


module.exports = connection1.models['hotness-category'] || connection1.model('hotness-category', hotnessCategory);
