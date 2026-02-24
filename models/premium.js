const mongoose = require('mongoose');
const { connection1 } = require('../db');

const Schema = mongoose.Schema;

const premiumData = new Schema({
    title: String,
    hiTitle: String,
    esTitle: String,
    androidId: String,
    iosId: String,
    isActive: {
        type: Boolean,
        default: false
    }
},
    {
        versionKey: false,
        timestamps: true
    });


module.exports = connection1.models['premium-plan'] || connection1.model('premium-plan', premiumData);
