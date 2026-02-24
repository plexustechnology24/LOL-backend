const mongoose = require('mongoose');
const { connection1 } = require('../db');


const Schema = mongoose.Schema;

const tempData = new Schema({
    EmailId: String,
    transactionId: String,
    ogTransactionId: String,
    purchaseDate: String,
    exDate: String,
    case: String,
    status: String,
    btransactionId: String,
    bogTransactionId: String,
    bpurchaseDate: String,
    bexDate: String,
    bstatus: String
},
    {
        versionKey: false,
        timestamps: true
    });

module.exports = connection1.models['temp-data'] || connection1.model('temp-data', tempData);
