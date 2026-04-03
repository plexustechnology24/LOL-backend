const mongoose = require('mongoose');
const { connection2 } = require('../db');

const Schema = mongoose.Schema;

const UserAnalyticsData = new Schema({
    id: {
        type: String,
        required: true,
        unique: true
    },
    questions: [
        {
            category: String,
            view: {
                type: Number,
                default: 0
            },
            share: {
                type: Number,
                default: 0
            },
            reply: {
                type: Number,
                default: 0
            }
        }
    ]
},
    { timestamps: true });


module.exports = connection2.models.UserAnalytics || connection2.model('user-analytics', UserAnalyticsData)