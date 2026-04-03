const PREMIUM = require('../models/premium');
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

exports.Create = async function (req, res, next) {
    try {
        if (req.body.title) {
            req.body.hiTitle = await translateText(req.body.title, "en", "hi");
            req.body.esTitle = await translateText(req.body.title, "en", "es");
            req.body.taTitle = await translateText(req.body.title, "en", "ta");
            req.body.mrTitle = await translateText(req.body.title, "en", "mr");
            req.body.enhiTitle = await convertToHinglish(req.body.hiTitle);
        }
        // 1️⃣ Count how many plans exist
        const count = await PREMIUM.countDocuments();

        // 2️⃣ If it's NOT the first record and the new one has isActive = true
        if (count > 0 && req.body.isActive === true) {
            // Set all other plans' isActive to false
            await PREMIUM.updateMany({}, { isActive: false });
        }

        // 3️⃣ Create the new plan
        const datacreate = await PREMIUM.create(req.body);

        res.status(201).json({
            status: 1,
            message: 'Premium Plan Created Successfully',
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
        // Extract pagination parameters from request
        const page = parseInt(req.body.page) || 1;
        const limit = parseInt(req.body.limit) || 15;
        const skip = (page - 1) * limit;

        // Get total count for pagination metadata
        const totalItems = await PREMIUM.countDocuments();

        // Query with pagination
        const data = await PREMIUM.find()
            .sort({ _id: -1 }) // Newest first
            .skip(skip)
            .limit(limit)
            .lean();

        res.status(200).json({
            status: 1,
            message: 'Premium Plan Found Successfully',
            data: data,
            pagination: {
                currentPage: page,
                itemsPerPage: limit,
                totalItems: totalItems,
                totalPages: Math.ceil(totalItems / limit)
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
        if (req.body.title) {
            req.body.hiTitle = await translateText(req.body.title, "en", "hi");
            req.body.esTitle = await translateText(req.body.title, "en", "es");
            req.body.taTitle = await translateText(req.body.title, "en", "ta");
            req.body.mrTitle = await translateText(req.body.title, "en", "mr");
            req.body.enhiTitle = await convertToHinglish(req.body.hiTitle);
        }

        if ( req.body.isActive === true ) {
            await PREMIUM.updateMany({}, { isActive: false });
        }

        // 2️⃣ Update the selected plan
        const updatedAd = await PREMIUM.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        res.status(200).json({
            status: 1,
            message: 'Premium Plan Updated Successfully',
            data: updatedAd,
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
        const deleted = await PREMIUM.findByIdAndDelete(req.params.id);

        if (!deleted) {
            return res.status(404).json({
                status: 0,
                message: "Data not found",
            });
        }

        res.status(200).json({
            status: 1,
            message: `Premium Plan deleted successfully`,
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};




