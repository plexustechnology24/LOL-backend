const mongoose = require('mongoose');
const { connection1 } = require('../db');


const Schema = mongoose.Schema;

const webData = new Schema({
    ShareURL: String,
    category: String,
    sourceid: { type: String, required: true },
    install: { type: Number, default: 0 },
    name: String,
    username: String,
    society: String,
    collage: String,
    city: String,
    state: String,
    country: String,
},
    {
        versionKey: false,
        timestamps: true
    });

module.exports = connection1.models['web-Link'] || connection1.model('web-Link', webData);
