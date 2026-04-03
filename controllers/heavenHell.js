const CARDBG = require('../models/heavenHellCardBg');
const CONTENT = require('../models/heavenHellQue');
const axios = require('axios');
const { transliterate } = require("transliteration");

exports.Create = async function (req, res, next) {
    try {
        if (req.file) {
            req.body.CardBg = req.file.s3Url;
        }
        const datacreate = await CARDBG.create(req.body);

        res.status(201).json({
            status: 1,
            message: 'CardBg Added Successfully',
            data: datacreate,
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};

exports.Read = async function (req, res, next) {
    try {
        const { page = 1, limit = 15, category } = req.body;
        const skip = (page - 1) * limit;

        // Build query filter
        const filter = {};
        if (category && category !== '') {
            filter.Category = category;
        }

        const total = await CARDBG.countDocuments(filter);
        const data = await CARDBG.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        res.status(200).json({
            status: 1,
            message: 'CardBg Found Successfully',
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

exports.Update = async function (req, res, next) {
    try {
        console.log(req.body);

        if (req.file) {
            req.body.CardBg = req.file.s3Url;
        }

        const updatedCard = await CARDBG.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        res.status(200).json({
            status: 1,
            message: 'CardBg Updated Successfully',
            data: updatedCard,
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};

exports.Delete = async function (req, res, next) {
    try {
        const deleted = await CARDBG.findByIdAndDelete(req.params.id);

        if (!deleted) {
            return res.status(404).json({
                status: 0,
                message: "CardBg not found",
            });
        }

        res.status(200).json({
            status: 1,
            message: 'CardBg deleted successfully',
            data: deleted
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};


// =================================== Content =======================================


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

exports.ContentCreate = async function (req, res, next) {
    try {
        if (req.body.Content) {
            req.body.hiContent = await translateText(req.body.Content, "en", "hi");
            req.body.esContent = await translateText(req.body.Content, "en", "es");
            req.body.taContent = await translateText(req.body.Content, "en", "ta");
            req.body.mrContent = await translateText(req.body.Content, "en", "mr");
            req.body.enhiContent = await convertToHinglish(req.body.hiContent);
        }

        const datacreate = await CONTENT.create(req.body);

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
        const { page = 1, limit = 15, category } = req.body;
        const skip = (page - 1) * limit;

        // Build query filter
        const filter = {};

        const total = await CONTENT.countDocuments(filter);
        const data = await CONTENT.find(filter)
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

        if (req.body.Content) {
            req.body.hiContent = await translateText(req.body.Content, "en", "hi");
            req.body.esContent = await translateText(req.body.Content, "en", "es");
            req.body.taContent = await translateText(req.body.Content, "en", "ta");
            req.body.mrContent = await translateText(req.body.Content, "en", "mr");
            req.body.enhiContent = await convertToHinglish(req.body.hiContent);
        }

        const updatedCard = await CONTENT.findByIdAndUpdate(
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
        const deleted = await CONTENT.findByIdAndDelete(req.params.id);

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