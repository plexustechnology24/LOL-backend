const CARDBG = require('../models/emotionCardBg');
const EMOJI = require('../models/emotionEmoji');
const axios = require('axios');


// ============================= CardBg ===============================
exports.Create = async function (req, res, next) {
    try {
        console.log(req.body);
        
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
        console.log( req.body);
        
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


// ================================= Emoji =================================
exports.EmojiCreate = async function (req, res, next) {
    try {
        console.log(req.body);
        
        if (req.file) {
            req.body.Emoji = req.file.s3Url;
        }
        const datacreate = await EMOJI.create(req.body);

        res.status(201).json({
            status: 1,
            message: 'Emoji Added Successfully',
            data: datacreate,
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};

exports.EmojiRead = async function (req, res, next) {
    try {
        const { page = 1, limit = 15, category } = req.body;
        const skip = (page - 1) * limit;

        // Build query filter
        const filter = {};
        if (category && category !== '') {
            filter.Category = category;
        }

        const total = await EMOJI.countDocuments(filter);
        const data = await EMOJI.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        res.status(200).json({
            status: 1,
            message: 'Emoji Found Successfully',
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

exports.EmojiUpdate = async function (req, res, next) {
    try {
        console.log( req.body);
        
        if (req.file) {
            req.body.Emoji = req.file.s3Url;
        }

        const updatedCard = await EMOJI.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        res.status(200).json({
            status: 1,
            message: 'Emoji Updated Successfully',
            data: updatedCard,
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};

exports.EmojiDelete = async function (req, res, next) {
    try {
        const deleted = await EMOJI.findByIdAndDelete(req.params.id);

        if (!deleted) {
            return res.status(404).json({
                status: 0,
                message: "Emoji not found",
            });
        }

        res.status(200).json({
            status: 1,
            message: 'Emoji deleted successfully',
            data: deleted
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};
