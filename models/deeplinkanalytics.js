const mongoose = require('mongoose');
const { connection1 } = require('../db');

const Schema = mongoose.Schema;

const deeplinkanalyticsSchemaData = new Schema(
    {
        date: { type: String, required: true },
        sourceid: { type: String, required: true },
        platform: { type: String, required: true },
        view: { type: Number, default: 0 },
        install: { type: Number, default: 0 }
    },
    { 
        versionKey: false, 
        timestamps: true 
    }
);

module.exports = connection1.models['deeplink-analytics'] || connection1.model('deeplink-analytics', deeplinkanalyticsSchemaData);
