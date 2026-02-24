const mongoose = require('mongoose');
const { connection2 } = require('../db');

const Schema = mongoose.Schema;

const moreAppData = new Schema({
    enAppName: {
        type: String,
        required: true
    },
    hiAppName: {
        type: String,
        required: true
    },
    esAppName: {
        type: String,
        required: true
    },
    urAppName: {
        type: String,
        required: true
    },
    frAppName: {
        type: String,
        required: true
    },
    ptAppName: {
        type: String,
        required: true
    },
    inAppName: {
        type: String,
        required: true
    },
    arAppName: {
        type: String,
        required: true
    },
    packageName: {
        type: String,
        required: true
    },
    appId: {
        type: String,
        required: true
    },
    logo: {
        type: String,
        required: true
    }
},
    { timestamps: true });


module.exports = connection2.models.moreApp || connection2.model('moreApp', moreAppData)