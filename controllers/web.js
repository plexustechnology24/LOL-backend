const USERANALYTICS = require('../models2/userAnalytics');
const NUSER = require('../models2/usernew');

const CONTENT10 = require('../models/challengeContent');
const CONTENT2 = require('../models/picRoastContent');
const CONTENT4 = require('../models/emotionContent');
const CONTENT5 = require('../models/confessionContent');
const CONTENT6 = require('../models/hotnessContent');
const CONTENT7 = require('../models/friendContent');
const CONTENT8 = require('../models/roastContent');
const CONTENT9 = require('../models/bluffContent');
const CONTENT11 = require('../models/heavenHellContent');



exports.Create = async function (req, res, next) {
    try {
        const { category, username } = req.body;

        if (!category || !username) {
            throw new Error('category & question value is required');
        }

        const link = `lolcards.link/${req.body.username}`;
        const user = await NUSER.findOne({ link: link });
        console.log(user.id);

        if (!user) {
            throw new Error('User not found');
        }



        await USERANALYTICS.findOneAndUpdate(
            { id: user.id, "questions.category": category },
            { $inc: { "questions.$.view": 1 } },
            { new: true }
        ).then(async (doc) => {
            if (!doc) {
                await USERANALYTICS.findOneAndUpdate(
                    { id: user.id },
                    {
                        $push: {
                            questions: {
                                category: category,
                                view: 1,
                                share: 0
                            }
                        }
                    },
                    { upsert: true }
                );
            }
        });

        res.status(200).json({
            status: 1,
            message: 'Question Updated Successfully'
        });

    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};

// ============================== Web All Question Card Content ===============================
exports.WebCardContent = async (req, res, next) => {
    try {
        const { lanText, category, subCategory } = req.body;

        if (!category) {
            throw new Error('category value is required');
        }

        // 🧠 Category → Model mapping
        let Model;

        switch (category) {
            case "Q2hhbGxlbmdl": // Challenge
                Model = CONTENT10;
                break;
            case "UGljIFJvYXN0": // Pic Roast
                Model = CONTENT2;
                break;
            case "RW1vdGlvbg==": // Emotion
                Model = CONTENT4;
                break;
            case "Q29uZmVzc2lvbg==": // Confession
                Model = CONTENT5;
                break;
            case "SG90bmVzcw==": // Hotness
                Model = CONTENT6;
                break;
            case "RnJpZW5k": // Friend
                Model = CONTENT7;
                break;
            case "Um9hc3Q=": // Roast
                Model = CONTENT8;
                break;
            case "Qmx1ZmY=": // Bluff
                Model = CONTENT9;
                break;
            case "SGVhdmVuSGVsbA==": // HeavenHell
                Model = CONTENT11;
                break;

            default:
                throw new Error("Invalid category");
        }

        // 🌐 Language mapping
        const contentMap = {
            hi: "hiContent",
            ta: "taContent",
            mr: "mrContent",
            enhi: "enhiContent"
        };

        const key = contentMap[lanText] || "Content";

        // 🧩 Dynamic match condition
        let matchStage = {
            [key]: { $exists: true, $ne: "" }
        };

        // 👉 If subCategory present → add filter
        if (subCategory) {
            matchStage.Category = subCategory;
        }

        // 🎲 Aggregation
        const [data] = await Model.aggregate([
            { $match: matchStage },
            { $sample: { size: 1 } }
        ]);

        if (!data) {
            throw new Error("No content found for given filters");
        }

        res.status(200).json({
            status: 1,
            message: "Success",
            data: {
                Content: data[key],
            }
        });

    } catch (error) {
        res.status(400).json({ status: 0, message: error.message });
    }
};