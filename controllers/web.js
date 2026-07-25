const USERANALYTICS = require('../models2/userAnalytics');
const annoyQuestions = require('../constants/annoyQuestions');


const CONTENT10 = require('../models/challengeContent');
const CONTENT2 = require('../models/picRoastContent');
const CONTENT4 = require('../models/emotionContent');
const CONTENT5 = require('../models/confessionContent');
const CONTENT6 = require('../models/hotnessContent');
const CONTENT7 = require('../models/friendContent');
const CONTENT8 = require('../models/roastContent');
const CONTENT9 = require('../models/bluffContent');
const CONTENT11 = require('../models/heavenHellContent');
const CONTENT12 = require('../models/reputationContent');
const CONTENT13 = require('../models/impressionContent');


const CARDBG = require('../models/cardBg');
const ECARDBG = require('../models/emotionCardBg');
const HCARDBG = require('../models/hotnessCardBg');
const HHCARDBG = require('../models/heavenHellCardBg');
const FCARDBG = require('../models/friendCardBg');
const BCARDBG = require('../models/bluffCardBg');
const ICARDBG = require('../models/impressionCardBg');
const RCARDBG = require('../models/reputationCardBg');

const EMOJI = require('../models/emotionEmoji');
const HOTNESSCATEGORY = require('../models/hotnessCategory');

const NUSER = require('../models2/usernew');
const NINBOX = require('../models2/inboxnew');
const DEVICE = require('../models/device');

const WEB = require('../models/web');

// =================== COMMON FUNCTION ==========================

const getRandom = async (Model, match = {}) => {
    const [data] = await Model.aggregate([
        { $match: match },
        { $sample: { size: 1 } }
    ]);

    return data;
};

// =========================================

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
const CATEGORY_MODELS = {
    "Q2hhbGxlbmdl": CONTENT10,
    "UGljIFJvYXN0": CONTENT2,
    "RW1vdGlvbg==": CONTENT4,
    "Q29uZmVzc2lvbg==": CONTENT5,
    "SG90bmVzcw==": CONTENT6,
    "RnJpZW5k": CONTENT7,
    "Um9hc3Q=": CONTENT8,
    "Qmx1ZmY=": CONTENT9,
    "SGVhdmVuSGVsbA==": CONTENT11,
    "UmVwdXRhdGlvbg==": CONTENT12,
    "SW1wcmVzc2lvbg==": CONTENT13
};

exports.WebCardContent = async (req, res, next) => {
    try {
        const { lanText, category, subCategory } = req.body;

        if (!category) {
            throw new Error('category value is required');
        }

        // 🧠 Category → Model mapping
        const Model = CATEGORY_MODELS[category];

        if (!Model) {
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

        //  Dynamic match condition
        let matchStage = {
            [key]: { $exists: true, $ne: "" }
        };

        //  If subCategory present → add filter
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

// ============================= que 6 , 7 , 9 , 11 , 12 , 13 cardPreview ===================================
exports.WebCommonCardPreview = async (req, res) => {
    try {
        const { type, category } = req.body;

        const config = {
            hotness: HCARDBG,
            friend: FCARDBG,
            bluff: BCARDBG,
            heavenhell: HHCARDBG,
            impression: ICARDBG,
            reputation: RCARDBG
        };

        const Model = config[type];

        if (!Model) {
            throw new Error("Invalid type");
        }

        const filter = ["bluff", "heavenhell"].includes(type)
            ? { Category: category }
            : {};

        if (["bluff", "heavenhell"].includes(type) && !category) {
            throw new Error("Category is required");
        }

        const data = await getRandom(Model, filter);

        res.status(200).json({
            status: 1,
            message: "Success",
            data: {
                CardBg: data?.CardBg
            }
        });

    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message
        });
    }
};




exports.WebCardPreview = async function (req, res, next) {
    try {
        // 🎴 Get random Card Background
        const CardBg = await CARDBG.aggregate([{ $sample: { size: 1 } }]);

        if (!CardBg.length) {
            throw new Error("No card backgrounds found");
        }

        // 🎨 Shape URLs with names
        const shapes = [
            { name: "circle", url: "https://lol-image-bucket.s3.ap-south-1.amazonaws.com/shape1.png" },
            { name: "square", url: "https://lol-image-bucket.s3.ap-south-1.amazonaws.com/shape2.png" },
            { name: "circle", url: "https://lol-image-bucket.s3.ap-south-1.amazonaws.com/shape3.png" }
        ];
        const fonts = ["Pure", "Spider"];

        // Random picks
        const randomShape = shapes[Math.floor(Math.random() * shapes.length)];
        const randomFont = fonts[Math.floor(Math.random() * fonts.length)];

        res.status(200).json({
            status: 1,
            message: "Success",
            data: {
                CardBg: CardBg[0].CardBg,
                shapeUrl: randomShape.url,
                shapeName: randomShape.name,
                fontName: randomFont
            }
        });

    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};


exports.WebEmotionCardPreview = async (req, res, next) => {
    try {
        const decibel = Number(req.body.decibel);
        if (isNaN(decibel)) return res.status(400).json({ status: 0, message: "Decibel must be a number" });

        const getCategory = (decibel) => {
            const tubeDecibel = Math.max(decibel - 15, 0);
            return tubeDecibel >= 0 && tubeDecibel <= 22.5 ? "Sad" :
                tubeDecibel <= 45 ? "Happy" :
                    tubeDecibel <= 67.5 ? "Love" :
                        tubeDecibel <= 100 ? "Angry" :
                            "Sad";
        };

        const Category = getCategory(decibel);
        if (!Category) return res.status(400).json({ status: 0, message: "Invalid decibel value" });

        const [CardBg, Emoji] = await Promise.all([
            ECARDBG.aggregate([{ $match: { Category } }, { $sample: { size: 1 } }]),
            EMOJI.aggregate([{ $match: { Category } }, { $sample: { size: 1 } }])
        ]);

        if (!CardBg[0] || !Emoji[0]) {
            return res.status(400).json({ status: 0, message: "No data found for this category" });
        }

        res.status(200).json({
            status: 1,
            message: "Success",
            data: {
                CardBg: CardBg[0].CardBg,
                Emoji: Emoji[0].Emoji
            }
        });

    } catch (error) {
        res.status(400).json({ status: 0, message: error.message });
    }
};

// ============================ web category 6 data get ================================
exports.WebRoastHostId = async (req, res) => {
    try {
        const { hotnessId, lanText } = req.body;

        if (!hotnessId) {
            return res.status(400).json({
                status: 0,
                message: "hotnessId is required"
            });
        }

        // find all matching categories
        const data = await HOTNESSCATEGORY.find({
            categoryId: Number(hotnessId)
        });

        // Check if any data found
        if (!data || data.length === 0) {
            return res.status(404).json({
                status: 0,
                message: "Category not found"
            });
        }

        // Map through all data and create response objects
        const responseData = data.map(item => {
            let obj = {
                image: item.subCatergoryImage,
                cardImage: item.cardImage || "https://lol-image-bucket.s3.ap-south-1.amazonaws.com/images/question6/whitecard.png",
            };


            // default English
            const langMap = {
                hi: "hisubCatergoryTitle",
                ta: "tasubCatergoryTitle",
                mr: "mrsubCatergoryTitle",
                enhi: "enhisubCatergoryTitle"
            };

            const key = langMap[lanText];

            obj.name = item[key] || item.subCatergoryTitle;

            return obj;
        });

        const shuffleArray = (array) => {
            return array.sort(() => Math.random() - 0.5);
        };

        const shuffledData = shuffleArray(responseData);


        res.status(200).json({
            status: 1,
            message: "Success",
            data: shuffledData,
            title: data[0].categoryTitle 
        });

    } catch (error) {
        console.error('Error in WebRoastHostId:', error);
        res.status(500).json({
            status: 0,
            message: error.message
        });
    }
};

// ======================= main category found api =============================
exports.CategoryWeb = async function (req, res, next) {
    try {
        const link = `lolcards.link/${req.body.username}`;
        const user = await NUSER.findOne({ link: link });

        let usernot = false;
        if (!user) {
            return res.status(200).json({
                status: 1,
                message: "Data Found Successfully",
                usernot: true
            });
        }

        // ======================== block =============================
        let block = false;
        if (user.blockList && user.blockList.includes(req.body.ip)) {
            block = true;
        }
        // ==================== allowed ======================================
        let notAllowed = false;

        const now = new Date();

        const startOfDay = new Date(Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate(),
            0, 0, 0, 0
        ));

        const endOfDay = new Date(Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate(),
            23, 59, 59, 999
        ));

        // ✅ Step 1: find device
        const device = await DEVICE.findOne({
            webDeviceIds: req.body.ip
        });

        if (!device) {
            // ✅ Step 2: count using deviceId
            const todayCount = await NINBOX.countDocuments({
                id: user.id,
                ip: req.body.ip,
                category: req.body.category,
                createdAt: {
                    $gte: startOfDay,
                    $lte: endOfDay
                }
            });

            // ✅ Step 3: apply limit
            if (todayCount >= 3) {
                notAllowed = true;
            }
        }

        // ================================

        const inboxDoc = await NINBOX.findOne(
            { ip: req.body.ip },                // filter condition
            { hint: 1, hintImage: 1, _id: 0 }   // projection (fields to include/exclude)
        ).sort({ _id: -1 });

        let responseData = {};

        if (inboxDoc) {

            // If hint exists and is not empty
            if (inboxDoc.hint && inboxDoc.hint !== "-") {
                responseData.hintText = inboxDoc.hint;
            }
            // Else if hintImage exists but not S3 link — assume it’s emoji
            else if (inboxDoc.hintImage) {
                responseData.selectedImage = inboxDoc.hintImage;
            }
        }

        const matched = Array.isArray(user.question)
            ? user.question.find(
                q => q.category === req.body.category &&
                    String(q.answer?.timestamp) === String(req.body.timestamp)
            )
            : null;

        if (!matched) {
            throw new Error("Question not found");
        }


        if (req.body.category === "QW5ub3kgZnVuIENhcmQ=") {
            // Step 1: Get language-based array
            const lan = matched.lan || "en";
            const baseArray = annoyQuestions[lan] || annoyQuestions.en;

            // Step 2: Merge with user.annoyallcardtitle (if exists)
            const mergedArray = Array.isArray(user.annoyallcardtitle)
                ? [...baseArray, ...user.annoyallcardtitle]
                : baseArray;

            // Step 3: Get indices and find values
            const indices = matched.answer?.annoycardtitle || [];
            const annoycardvalue = indices.map(index => mergedArray[index]).filter(Boolean);
            // console.log(indices, "index");
            // console.log(annoycardvalue, "annoycardvalue");


            const userWithValues = {
                ...user.toObject(),
                annoycardvalue: annoycardvalue
            };

            // Step 4: Send result
            return res.status(200).json({
                status: 1,
                message: "Data Found Successfully",
                data: userWithValues,
                block: block,
                notAllowed: notAllowed,
                usernot: usernot,
                inboxDoc: responseData
            });
        }


        // Default response
        res.status(200).json({
            status: 1,
            message: "Data Found Successfully",
            data: user,
            block: block,
            notAllowed: notAllowed,
            usernot: usernot,
            inboxDoc: responseData
        });

    } catch (error) {
        console.log(error.message);
        
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};

// ============================= last popup web install ============================

exports.WebInstall = async function (req, res, next) {
    try {
        let { category, username, timestamp } = req.body;

        let link;

        if (category === "UGljIFJvYXN0") {
            link = `https://lolcards.link/${username}/${category}/${timestamp}`;
        } else {
            link = `https://lolcards.link/${username}/${category}`;
        }

        const user = await WEB.findOne({ ShareURL: link });

        res.status(200).json({
            status: 1,
            message: "Success",
            sourceid: user?.sourceid || ""
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};

// =================  web genearte ip ==========================
exports.CategoryWebIp = async function (req, res, next) {
    try {
        // Step 1: Get all inbox docs only ip field
        const inboxes = await NINBOX.find({}, { ip: 1, _id: 0 }).lean();

        // Step 2: Existing IPs ni list banavi
        const existingIps = inboxes.map((item) => item.ip);

        // Step 3: Ek unique random IP generate karvi
        let newIp;
        do {
            newIp = uuidv4();
        } while (existingIps.includes(newIp)); // jo existing ma hoy to fari generate

        // Step 4: Response ma aapo
        res.status(200).json({
            status: 1,
            message: "IP created successfully",
            ip: newIp,
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};