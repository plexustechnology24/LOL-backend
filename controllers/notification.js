const NOTIFICATION = require('../models/autonotification');
const PUSHNOTIFICATION = require('../models/pushnotification');
const NUSER = require('../models2/usernew');
const axios = require('axios');


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
        if (req.body.Description) {
            req.body.hiDescription = await translateText(req.body.Description, "en", "hi");
            req.body.esDescription = await translateText(req.body.Description, "en", "es");
            // req.body.frDescription = await translateText(req.body.Description, "en", "fr");
            // req.body.urDescription = await translateText(req.body.Description, "en", "ur");
        }

        if (req.body.type === "push") {
            // Create data in the PUSHNOTIFICATION collection
            const pushData = await PUSHNOTIFICATION.create(req.body);
            // Call sendPushNotification function
            await sendPushNotification(pushData.Title, pushData.Description, pushData.hiDescription, pushData.esDescription);

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
        const Model = req.body.type === "push" ? PUSHNOTIFICATION : NOTIFICATION;

        // Build query object
        let query = {};
        if (searchTerm.trim() !== '') {
            query.Description = {
                $regex: searchTerm,
                $options: 'i' // Case insensitive search
            };
        }

        // Get total count for pagination metadata with search filter
        const totalItems = await Model.countDocuments(query);

        // Query with pagination and search
        const data = await Model.find(query)
            .sort({ _id: -1 }) // Newest first
            .skip(skip)
            .limit(limit)
            .lean();

        console.log(data);

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
            req.body.esDescription = await translateText(req.body.Description, "en", "es");
            // req.body.frDescription = await translateText(req.body.Description, "en", "fr");
            // req.body.urDescription = await translateText(req.body.Description, "en", "ur");
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
        const { type } = req.body; // get type from body
        const { id } = req.params;

        let Model;

        if (type && type.toLowerCase() === "push") {
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
            message: `${type && type.toLowerCase() === "push" ? "Push" : "Notification"} deleted successfully`,
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};


// =====================================================
const sendPushNotification = async (Title, Description, hiDescription, esDescription) => {
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
            hi: hiDescription || Description,
            es: esDescription || Description
        }
    };

    try {
        const response = await axios.post(url, data, { headers });
        console.log('Push Notification Response:', response.data);
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
//         console.log("MyMemory:", res.data.responseData.translatedText);
//     } catch (err) {
//         console.error(err.message);
//     }
// }

// translate();
