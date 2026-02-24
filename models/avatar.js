const mongoose = require('mongoose');
const { connection1 } = require('../db');

const Schema = mongoose.Schema;

const avatarData = new Schema({
    avatar: {
        type: String,
        required: true
    }
}, {
    versionKey: false,
    timestamps: true
});

module.exports = connection1.models.avatar || connection1.model('avatar', avatarData);