const mongoose = require('mongoose');
const { connection1 } = require('../db');

const Schema = mongoose.Schema;

const categoryData = new Schema({
    category: {
        name: String,
        open: Number,
        share: Number,
        admin: {
            type: Boolean,
            default: false
        }
    }
});

module.exports = connection1.models.category || connection1.model('category', categoryData);
