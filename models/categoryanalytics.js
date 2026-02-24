const mongoose = require('mongoose');
const { connection1 } = require('../db');

const Schema = mongoose.Schema;

const categoryanalyticsSchemaData = new Schema(
    {
        date: { type: String, required: true },
        category: { type: String, required: true },
        share: { type: Number, default: 0 },
        open: { type: Number, default: 0 }
    },
    { 
        versionKey: false, 
        timestamps: true 
    }
);

module.exports = connection1.models['category-analytics'] || connection1.model('category-analytics', categoryanalyticsSchemaData);
