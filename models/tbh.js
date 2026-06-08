const mongoose = require('mongoose');
const { connection1 } = require('../db');

const Schema = mongoose.Schema;

const tbhContentData = new Schema(
    {
        color: {
            type: String,
            default: ''
        },

        names: [
            {
                name: String,
                encodedName: String,

                questions: {
                    en: [String],
                    hi: [String],
                    mr: [String],
                    enhi: [String]
                }
            }
        ],

        type: {
            type: String,
            enum: ['spinner', 'content', 'title', 'audio'],
            required: true
        },
        CardImage: String
    },
    {
        versionKey: false,
        timestamps: true
    }
);

module.exports =
    connection1.models['tbh-content'] ||
    connection1.model('tbh-content', tbhContentData);