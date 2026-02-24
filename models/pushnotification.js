const mongoose = require('mongoose');
const { connection1 } = require('../db');

const Schema = mongoose.Schema;

const pushNotificationData = new Schema({
    Title: String,
    Description: String,
    hiDescription: String,
    esDescription: String
},
    {
        versionKey: false,
        timestamps: true
    });


module.exports = connection1.models['push-notification'] || connection1.model('push-notification', pushNotificationData);
