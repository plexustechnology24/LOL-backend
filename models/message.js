const mongoose = require('mongoose');
const { connection1 } = require('../db');

const Schema = mongoose.Schema;

const messageData = new Schema({
    id: String,
    category: String,
    question: String,
    answer: {
        word: String, //1
        contentFile: String,  //1
        image: String,  //2
        comment: String, //2
        quetype: String, //2
        annoyimage : String,  //3
        nickname : String,  //3
        annoycardtitle : [String],  //3
        annoyans : [String],  //3
        cardBg : String,   //3
        shapeUrl : String,    //3
        fontname : String,     //3
        shapename : String,  //3
        emotionBg: String,  //4
        emotionEmoji: String, //4
        emotionContent: String, //4
        emotionTitle: String, //4
        emotionVoice: String, //4
        confessionType: String,  //5
        confessionTitle: String, //5
        confessionContent: String, //5
        confessionVoice: String, //5
        confessionEmoji: String, //5
        hotnessBg: String, //6
        hotnessName: String, //6
        hotnessEmoji: String, //6
        hotnessHand: String, //6
        hotnessComment: String, //6
        friendBg: String, //7
        friendContent: String, //7
        friendEmoji: String, //7
        friendName: String, //7
        roastType: String,  //8
        roastContent: String, //8
        roastVoice: String, //8
        roastEmoji: String, //8
        bluffBg: String,  //9
        bluffContent: String, //9
        bluffEmoji: String, //9
        challengeContent: String, //10
    },
    hint: {
        type: String,
        required: true
    },
    hintImage: {
        type: String
    },
    hintContent: {
        type: String
    },
    location: {
        type: String,
        required: true
    },
    country: {
        type: String,
        required: true
    },
    ip: String,
    time: String
},
    { timestamps: true });


module.exports = connection1.models['random-message'] || connection1.model('random-message', messageData);
