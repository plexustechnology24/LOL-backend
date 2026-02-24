const mongoose = require('mongoose');
const { connection1 } = require('../db'); 

const Schema = mongoose.Schema;

const deeplinkSchemaData = new Schema({
    link: String,
    source: String,
    sourceid: String,
    lock:
    {
        type: Boolean,
        required: true
    },
}, 
{ 
    versionKey: false,
    timestamps: true 
}); 

module.exports = connection1.models.deeplink || connection1.model('deeplink', deeplinkSchemaData);
