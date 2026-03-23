const mongoose = require('mongoose');
const { connection1 } = require('../db');

const Schema = mongoose.Schema;

const comingSoonData = new Schema({
    Title: String,
    Description: String,
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
