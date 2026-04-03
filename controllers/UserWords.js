const WORDS = require('../models2/UserWords');


const WORD = require('../models2/UserWords');

exports.Create = async function (req, res) {
    try {
        let { id, category, words } = req.body;

        if (!category || !words) {
            throw new Error ("category and word required")
        }

        // always convert string → array
        words = [words.trim()];

        let existing = await WORD.findOne({ id, category });

        if (existing) {
            //  add word only if not exists
            if (!existing.words.includes(words[0])) {
                existing.words.push(words[0]);
                await existing.save();
            }

            return res.status(200).json({
                status: 1,
                message: 'Word added successfully',
                data: existing
            });
        }

        // create new
        const newData = await WORD.create({
            id,
            category,
            words
        });

        res.status(201).json({
            status: 1,
            message: 'New entry created successfully',
            data: newData
        });

    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message
        });
    }
};


exports.Read = async function (req, res) {
    try {
        const { id, category } = req.body;

        if (!category) {
            throw new Error("category required");
        }

        const data = await WORD.findOne({ id, category });

        return res.status(200).json({
            status: 1,
            message: 'Words fetched successfully',
            data: data ? data.words : [] 
        });

    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message
        });
    }
};