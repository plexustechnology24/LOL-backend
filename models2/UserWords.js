const mongoose = require('mongoose');
const { connection2 } = require('../db');

const Schema = mongoose.Schema;

const UserWordData = new Schema({
    id: {
        type: String,
        required: true,
    },
    category: {
        type: String,
        enum: ['V2hvVGFsa2lu', 'RW1vdGlvbg=='], 
        required: true
    },
    words: [
        {
            type: String,
            trim: true
        }
    ]
},
    { timestamps: true });


module.exports = connection2.models.UserWord || connection2.model('user-word', UserWordData)