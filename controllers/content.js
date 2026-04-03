const CONTENT = require('../models/content');
const EMOTION = require('../models/emotionContent');
const CHALLENGE = require('../models/challengeContent');
const PICROAST = require('../models/picRoastContent');
const CONFESSION = require('../models/confessionContent');
const HOTNESS = require('../models/hotnessContent');
const FRIEND = require('../models/friendContent');
const ROAST = require('../models/roastContent');
const BLUFF = require('../models/bluffContent');
const HELLHEAVEN = require('../models/heavenHellContent');
const axios = require('axios');

const { transliterate } = require("transliteration");

function convertToHinglish(text) {
    // Emoji detect regex
    const emojiRegex = /([\u231A-\uD83E\uDDFF\uD83C-\uDBFF\uDC00-\uDFFF]+)/g;

    const emojis = text.match(emojiRegex) || [];

    // Remove emoji temporarily
    const textWithoutEmoji = text.replace(emojiRegex, '');

    // Transliterate only text
    const hinglishText = transliterate(textWithoutEmoji);

    // Add emoji back at end
    return hinglishText.trim() + " " + emojis.join(" ");
}


// =================================== Content =======================================
async function translateText(text, from, to) {
    try {
        const res = await axios.get("https://api.mymemory.translated.net/get", {
            params: {
                q: text,
                langpair: `${from}|${to}`
            }
        });
        return res.data.responseData.translatedText;
    } catch (err) {
        console.error(`Translation error (${to}):`, err.message);
        return text; // fallback: return original text
    }
}

const MODEL_MAP = {
    hint: CONTENT,
    emotion: EMOTION,
    challenge: CHALLENGE,
    picroast: PICROAST,
    confession: CONFESSION,
    hotness: HOTNESS,
    friend: FRIEND,
    roast: ROAST,
    bluff: BLUFF,
    hellheaven: HELLHEAVEN
};

exports.ContentCreate = async function (req, res, next) {
    try {
        const { question, Content } = req.body;

        const SelectedModel = MODEL_MAP[question];

        if (!SelectedModel) {
            throw new Error("Invalid question type");         
        }

        if (Content) {
            req.body.hiContent = await translateText(Content, "en", "hi");
            req.body.esContent = await translateText(Content, "en", "es");
            req.body.taContent = await translateText(Content, "en", "ta");
            req.body.mrContent = await translateText(Content, "en", "mr");
            req.body.enhiContent = await convertToHinglish(req.body.hiContent);
        }

        const datacreate = await SelectedModel.create(req.body);

        res.status(201).json({
            status: 1,
            message: 'Content Added Successfully',
            data: datacreate,
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};

exports.ContentRead = async function (req, res, next) {
    try {
        const { page = 1, limit = 15, category, question } = req.body;
        const skip = (page - 1) * limit;

        const SelectedModel = MODEL_MAP[question];

        if (!SelectedModel) {
            throw new Error("Invalid question type");         
        }

        // No filter — fetch ALL content
        const filter = {};
        if (category && category !== '') {
            filter.Category = category;
        }

        const total = await SelectedModel.countDocuments(filter);
        const data = await SelectedModel.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        res.status(200).json({
            status: 1,
            message: 'Content Found Successfully',
            data: data,
            pagination: {
                total: total,
                totalPages: Math.ceil(total / limit),
                currentPage: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};


exports.ContentUpdate = async function (req, res, next) {
    try {
        const { question, Content } = req.body;

        const SelectedModel = MODEL_MAP[question];

        if (!SelectedModel) {
            throw new Error("Invalid question type");         
        }

        if (Content) {
            req.body.hiContent = await translateText(Content, "en", "hi");
            req.body.esContent = await translateText(Content, "en", "es");
            req.body.taContent = await translateText(Content, "en", "ta");
            req.body.mrContent = await translateText(Content, "en", "mr");
            req.body.enhiContent = await convertToHinglish(req.body.hiContent);
        }
        
        const updatedCard = await SelectedModel.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        res.status(200).json({
            status: 1,
            message: 'Content Updated Successfully',
            data: updatedCard,
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};

exports.ContentDelete = async function (req, res, next) {
    try {
        const { question } = req.body;

        const SelectedModel = MODEL_MAP[question];
        
        if (!SelectedModel) {
            throw new Error("Invalid question type");         
        }
        const deleted = await SelectedModel.findByIdAndDelete(req.params.id);

        if (!deleted) {
            return res.status(404).json({
                status: 0,
                message: "Content not found",
            });
        }

        res.status(200).json({
            status: 1,
            message: 'Content deleted successfully',
            data: deleted
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};