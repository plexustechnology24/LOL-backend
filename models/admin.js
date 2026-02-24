const mongoose = require('mongoose');
const { connection1 } = require('../db');

const Schema = mongoose.Schema;

const adminData = new Schema({
    email: {
        type: String,
        unique: true,
        required: true
    },
    pass: {
        type: String,
        required: true
    },
    confirmpass: String,
    AdsStatus:
    {
        type: Boolean,
        enum: ['true', 'false'],
        default: 'false',
        required: true
    },
    category: [
        {
            name: String,
            value: Number
        }
    ]
},
    { timestamps: true });


module.exports = connection1.models.admin || connection1.model('admin', adminData)