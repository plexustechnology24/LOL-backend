const NOTIFICATION = require('../models/autonotification');
const PUSHNOTIFICATION = require('../models/pushnotification');
const NUSER = require('../models2/usernew');
const axios = require('axios');
const OneSignal = require('onesignal-node');
const { translateText } = require('../utils/translator');

// Initialize the OneSignal Client
const client = new OneSignal.Client(
    '69c53fa2-c84d-42a9-b377-1e4fff31fa18',
    'OTMxMGNiMmItYzgzZi00ODU0LTgyNjUtZmYwY2M1NWFmNGZk'
);

exports.Create = async function (req, res, next) {
    try {
        if (req.body.Description) {
            req.body.hiDescription = await translateText(req.body.Description, "en", "hi");
            req.body.mrDescription = await translateText(req.body.Description, "en", "mr");
            // req.body.taDescription = await translateText(req.body.Description, "en", "ta");
        }
        if (req.body.Title) {
            req.body.hiTitle = await translateText(req.body.Title, "en", "hi");
            req.body.mrTitle = await translateText(req.body.Title, "en", "mr");
            // req.body.taTitle = await translateText(req.body.Title, "en", "ta");
        }
        

        if (req.body.modelType === "push") {
            // Create data in the PUSHNOTIFICATION collection
            const pushData = await PUSHNOTIFICATION.create(req.body);
            // Call sendPushNotification function
            // await sendPushNotification(pushData.Title, pushData.Description, pushData.hiDescription, pushData.taDescription);
            await sendPushNotificationLanguageWise(pushData);
            res.status(201).json({
                status: 1,
                message: 'Push Notification Created and Sent Successfully',
                data: pushData,
            });
        } else {
            // Default handling for NOTIFICATION collection
            const data = await NOTIFICATION.create(req.body);

            res.status(201).json({
                status: 1,
                message: 'Data Created Successfully',
                data: data,
            });
        }
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
        const searchTerm = req.body.search || ''; // Get search term from request

        // Determine which model to query based on the type
        const Model = req.body.modelType === "push" ? PUSHNOTIFICATION : NOTIFICATION;

        // Build query object
        const type = req.body.type;
        let query = {};
        if (searchTerm.trim() !== '') {
            query.Description = {
                $regex: searchTerm,
                $options: 'i' // Case insensitive search
            };
        }
        if (type) {
            query.type = type; // NEW filter
        }

        // Get total count for pagination metadata with search filter
        const totalItems = await Model.countDocuments(query);

        // Query with pagination and search
        const data = await Model.find(query)
            .sort({ _id: -1 }) // Newest first
            .skip(skip)
            .limit(limit)
            .lean();


        res.status(200).json({
            status: 1,
            message: 'Data Found Successfully',
            data: data,
            pagination: {
                currentPage: page,
                itemsPerPage: limit,
                totalItems: totalItems,
                totalPages: Math.ceil(totalItems / limit),
                searchTerm: searchTerm // Include search term in response
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
        if (req.body.Description) {
            req.body.hiDescription = await translateText(req.body.Description, "en", "hi");
            req.body.mrDescription = await translateText(req.body.Description, "en", "mr");
            // req.body.taDescription = await translateText(req.body.Description, "en", "ta");
        }
        if (req.body.Title) {
            req.body.hiTitle = await translateText(req.body.Title, "en", "hi");
            req.body.mrTitle = await translateText(req.body.Title, "en", "mr");
            // req.body.taTitle = await translateText(req.body.Title, "en", "ta");
        }

        const updatedAd = await NOTIFICATION.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.status(200).json({
            status: 1,
            message: 'Data Updated Successfully',
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
        const { modelType } = req.body; // get type from body
        const { id } = req.params;

        let Model;

        if (modelType && modelType.toLowerCase() === "push") {
            Model = PUSHNOTIFICATION;
        } else {
            Model = NOTIFICATION;
        }

        const deleted = await Model.findByIdAndDelete(id);

        if (!deleted) {
            return res.status(404).json({
                status: 0,
                message: "Data not found",
            });
        }

        res.status(200).json({
            status: 1,
            message: `${modelType && modelType.toLowerCase() === "push" ? "Push" : "Notification"} deleted successfully`,
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};


// =====================================================

const chunkArray = (arr, size = 2000) => {
    const result = [];
    for (let i = 0; i < arr.length; i += size) {
        result.push(arr.slice(i, i + size));
    }
    return result;
};

async function sendBulkNotification(playerIds, title, message, extraData = {}, iconUrl = 'https://lol-image-bucket.s3.ap-south-1.amazonaws.com/logo.png') {
    const notification = {
        include_player_ids: playerIds, // 🔥 multiple ids
        // data: {
        //     type: 'inbox',
        //     ...extraData,
        // },
        headings: {
            en: title
        },
        contents: {
            en: message
        },
        small_icon: "ic_stat_onesignal_default",
        large_icon: iconUrl || undefined
    };

    try {
        const response = await client.createNotification(notification);

        console.log("✅ Bulk Notification Sent:", response.body);
        return { success: true };

    } catch (error) {
        console.error("❌ Bulk Error:", error.body || error.message);
        return { success: false };
    }
}

const sendPushNotificationLanguageWise = async (pushData) => {

    const users = await NUSER.find();

    const isValidUUID = (id) => {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    };

    // const SUPPORTED_LANGUAGES = ['en', 'hi', 'enhi', 'mr', 'ta'];
    const SUPPORTED_LANGUAGES = ['en', 'hi', 'enhi', 'mr'];
    const languageGroups = {};

    for (const user of users) {
        let lang = user.language;

        if (!SUPPORTED_LANGUAGES.includes(lang)) {
            lang = 'en';
        }

        // 🔥 EN user → randomly assign 'en' or 'enhi' per send
        if (lang === 'en') {
            lang = Math.random() < 0.5 ? 'en' : 'enhi';
        }

        if (!languageGroups[lang]) {
            languageGroups[lang] = [];
        }

        languageGroups[lang].push(user);
    }

    // 🎯 Prepare content
    const title = {
        en: pushData.Title,
        hi: pushData.hiTitle,
        enhi: pushData.enhiTitle || pushData.Title,
        mr: pushData.mrTitle || pushData.Title,
        // ta: pushData.taTitle || pushData.Title
    };

    const messages = {
        en: pushData.Description,
        hi: pushData.hiDescription,
        enhi: pushData.enhiDescription || pushData.Description,
        mr: pushData.mrDescription || pushData.Description,
        // ta: pushData.taDescription || pushData.Description
    };

    // 🔁 Send notifications
    for (const lang in languageGroups) {
        try {
            const usersList = languageGroups[lang];

            const TEST_MODE = false;

            const TEST_PLAYER_IDS = [
                "95d70d90-3044-4681-8c21-1f1ca45f9335",
                "b508f818-cdba-4656-9bc9-fac3b1fafadb",
                "a2259499-f64e-4556-a91f-e566b8765ec2",
                "6b3c0122-e8f8-4641-984e-afdfaa56b4a5"
            ];

            const playerIds = TEST_MODE
                ? TEST_PLAYER_IDS
                : [
                    ...new Set(
                        usersList
                            .flatMap(u => u.deviceToken)
                            .filter(id => id && isValidUUID(id))
                    )
                ];

            if (!playerIds.length) continue;

            const batches = chunkArray(playerIds);

            for (const batch of batches) {
                // ✅ title/message directly from prepared content (no extra if block needed)
                await sendBulkNotification(
                    batch,
                    title[lang],
                    messages[lang],
                    { lang }
                );
            }

            console.log(`✅ ${lang} done`);

        } catch (err) {
            console.error(`❌ ${lang} error:`, err.message);
        }
    }
};


const sendPushNotification = async (Title, Description, hiDescription) => {
    const appId = '69c53fa2-c84d-42a9-b377-1e4fff31fa18';
    const apiKey = 'os_v2_app_nhct7iwijvbktm3xdzh76mp2da2jpkl4r2vuegu4sgn2tu363nbtac3vwdhnnhm7ogdvxbg7zi2d7tn5v6xwix7gyh6pga5bufr244a';

    const url = 'https://onesignal.com/api/v1/notifications';

    const headers = {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Basic ${apiKey}`,
    };

    const data = {
        app_id: appId,
        included_segments: ['All'],
        // headings: { en: Title },
        contents: {
            en: Description,
            hi: hiDescription || Description
        }
    };

    try {
        const response = await axios.post(url, data, { headers });
    } catch (error) {
        console.error('Error Sending Push Notification:', error.response?.data || error.message);
    }
};


// async function translate() {
//     try {
//         const res = await axios.get("https://api.mymemory.translated.net/get", {
//             params: {
//                 q: "New roast alert: Hope your ego has insurance 🛑",
//                 langpair: "en|hi" // English → Hindi
//             }
//         });
//     } catch (err) {
//         console.error(err.message);
//     }
// }

// translate();
