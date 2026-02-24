const mongoose = require('mongoose');
const { connection1 } = require('../db');

const Schema = mongoose.Schema;

const collabSchemaData = new Schema({
    id: {
        type: String,
    },
    email: {
        type: String,
        required: [true, "email is required"]
    },
    name: {
        type: String,
        required: [true, "name is required"]
    },
    number: String,
    city: {
        type: String,
        required: [true, "city is required"]
    },
    instaId: String,
    snapId: String,
    tiktokId: String,
    type: String,
    read: {
        type: Boolean,
        enum: ['true', 'false'],
        default: 'false',
        required: true
    },
},
    {
        versionKey: false,
        timestamps: true
    });

module.exports = connection1.models.collab || connection1.model('collab', collabSchemaData);
