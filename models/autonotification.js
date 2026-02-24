const mongoose = require('mongoose');
const { connection1 } = require('../db');

const Schema = mongoose.Schema;

const autoNotificationData = new Schema({
    Title: String,
    Description: String,
    hiDescription: String,
    esDescription: String
},
    {
        versionKey: false,
        timestamps: true
    });


module.exports = connection1.models['auto-notification'] || connection1.model('auto-notification', autoNotificationData);
