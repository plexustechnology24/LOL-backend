const mongoose = require('mongoose');
const { connection1 } = require('../db'); 

const Schema = mongoose.Schema;

const deviceSchemaData = new Schema({
    deviceName: String,
    devicePerson: String,
    deviceType: String,
    deviceId: String,
    emailIds: [String],
    webDeviceIds: [String],
}, 
{ 
    versionKey: false,
    timestamps: true 
}); 

module.exports = connection1.models.device || connection1.model('device', deviceSchemaData);
