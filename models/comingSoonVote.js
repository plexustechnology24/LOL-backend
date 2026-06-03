const mongoose = require('mongoose');
const { connection1 } = require('../db');

const Schema = mongoose.Schema;

const comingSoonVoteSchema = new Schema({
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        unique: true 
    },

    votes: [
        {
            comingSoonId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'comin-soon',
                required: true
            },
            vote: {
                type: Number,
                default: 1
            }
        }
    ]

}, {
    versionKey: false,
    timestamps: true
});

module.exports = connection1.models['coming-soon-vote'] ||
    connection1.model('coming-soon-vote', comingSoonVoteSchema);