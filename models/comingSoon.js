const mongoose = require('mongoose');
const { connection1 } = require('../db');

const Schema = mongoose.Schema;

const comingSoonData = new Schema({
    Title: String,
    hiTitle: String,
    esTitle: String,
    mrTitle: String,
    taTitle: String,
    enhiTitle: String,
    Description: String,
    hiDescription: String,
    esDescription: String,
    mrDescription: String,
    taDescription: String,
    enhiDescription: String,
    Image: String,
    fakeVotes: String,
    originalVotes: {
        type: Number,
        default: 0
    }
},
    {
        versionKey: false,
        timestamps: true
    });


module.exports = connection1.models['comin-soon'] || connection1.model('comin-soon', comingSoonData);
