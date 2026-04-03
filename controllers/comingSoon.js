const COMINGSOON = require('../models/comingSoon');
const COMINGSOONSUGGESTION = require('../models/comingSoonSuggestion');
const { convertToHinglish, translateText } = require('../utils/translator');


exports.Create = async function (req, res, next) {
    try {

        const { Title, Description } = req.body;


        if (Title) {
            req.body.hiTitle = await translateText(Title, "en", "hi");
            req.body.esTitle = await translateText(Title, "en", "es");
            req.body.taTitle = await translateText(Title, "en", "ta");
            req.body.mrTitle = await translateText(Title, "en", "mr");
            req.body.enhiTitle = await convertToHinglish(req.body.hiTitle);
        }

        if (Description) {
            req.body.hiDescription = await translateText(Description, "en", "hi");
            req.body.esDescription = await translateText(Description, "en", "es");
            req.body.taDescription = await translateText(Description, "en", "ta");
            req.body.mrDescription = await translateText(Description, "en", "mr");
            req.body.enhiDescription = await convertToHinglish(req.body.hiDescription);
        }

        const dataCreate = await COMINGSOON.create(req.body);

        res.status(201).json({
            status: 1,
            message: 'Data Created Successfully',
            data: dataCreate,
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

        const COMINGSOONData = await COMINGSOON.find();

        res.status(200).json({
            status: 1,
            message: 'Data Found Successfully',
            data: COMINGSOONData,
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};

exports.SuggestionRead = async function (req, res, next) {
    try {
        const { page = 1, limit = 15, } = req.body;
        const skip = (page - 1) * limit;

        const filter = {};

        const total = await COMINGSOONSUGGESTION.countDocuments(filter);
        const data = await COMINGSOONSUGGESTION.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        res.status(200).json({
            status: 1,
            message: 'Suggestion Found Successfully',
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

        const { Title, Description } = req.body;


        if (Title) {
            req.body.hiTitle = await translateText(Title, "en", "hi");
            req.body.esTitle = await translateText(Title, "en", "es");
            req.body.taTitle = await translateText(Title, "en", "ta");
            req.body.mrTitle = await translateText(Title, "en", "mr");
            req.body.enhiTitle = await convertToHinglish(req.body.hiTitle);
        }

        if (Description) {
            req.body.hiDescription = await translateText(Description, "en", "hi");
            req.body.esDescription = await translateText(Description, "en", "es");
            req.body.taDescription = await translateText(Description, "en", "ta");
            req.body.mrDescription = await translateText(Description, "en", "mr");
            req.body.enhiDescription = await convertToHinglish(req.body.hiDescription);
        }

        const dataUpdate = await COMINGSOON.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.status(200).json({
            status: 1,
            message: 'App Updated Successfully',
            data: dataUpdate,
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
        const { id } = req.params;
        const { type } = req.body; // ?type=suggestion

        let data;

        // 🔥 Suggestion delete
        if (type === 'suggestion') {
            data = await COMINGSOONSUGGESTION.findByIdAndDelete(id);
        } 
        else {
            data = await COMINGSOON.findByIdAndDelete(id);
        }

        if (!data) {
            return res.status(404).json({
                status: 0,
                message: 'Data Not Found'
            });
        }

        res.status(200).json({
            status: 1,
            message: 'Data Deleted Successfully',
        });

    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};;

exports.Find = async function (req, res, next) {
    try {
        const data = await COMINGSOON.find().select(
            'Title Description Image fakeVotes _id'
        );

        res.status(200).json({
            status: 1,
            message: 'Data Fetched Successfully',
            data: data
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};


exports.AddOriginalVote = async function (req, res, next) {
    try {
        const { id } = req.params;

        if (id == 1) {
            const { suggestion } = req.body;

            if (!suggestion) {
                throw new Error("Suggestion is required")
            }

            const newSuggestion = await COMINGSOONSUGGESTION.create({
                suggestions: suggestion
            });

            return res.status(200).json({
                status: 1,
                message: 'Suggestion Added Successfully',
                // data: newSuggestion
            });
        } else {

            // ✅ Normal vote increment
            const data = await COMINGSOON.findByIdAndUpdate(
                id,
                { $inc: { originalVotes: 1 } },
                { new: true }
            );

            if (!data) {
                throw new Error("Data Not Found")
            }

            res.status(200).json({
                status: 1,
                message: 'Vote Added Successfully',
                // data: data
            });

        }

    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};

