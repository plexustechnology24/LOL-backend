const mongoose = require('mongoose');
const { connection1 } = require('../db');

const Schema = mongoose.Schema;

const hotnessMainCategory = new Schema({
    categoryId: Number,
    categoryTitle: String,
    hicategoryTitle: String,
    escategoryTitle: String,
    tacategoryTitle: String,
    mrcategoryTitle: String,
    enhicategoryTitle: String,
    categoryImage: String,
},
    {
        versionKey: false,
        timestamps: true
    });


module.exports = connection1.models['hotness-main-category'] || connection1.model('hotness-main-category', hotnessMainCategory);
