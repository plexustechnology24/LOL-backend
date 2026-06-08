const mongoose = require('mongoose');
const { connection1 } = require('../db');

const Schema = mongoose.Schema;

const pushNotificationData = new Schema({
    type: String,
    Title: String,
    hiTitle: String,
    enhiTitle: String,
    mrTitle: String,
    taTitle: String,
    Description: String,
    hiDescription: String,
    enhiDescription: String,
    mrDescription: String,
    taDescription: String
},
    {
        versionKey: false,
        timestamps: true
    });


module.exports = connection1.models['push-notification'] || connection1.model('push-notification', pushNotificationData);
