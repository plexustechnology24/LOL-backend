const NUSER = require('../models2/usernew');
const NINBOX = require('../models2/inboxnew');
const WEB = require('../models/web');
const PREMIUM = require('../models/premium');
const CATEGORY = require('../models/category');
const CATEGORYANALYTICS = require('../models/categoryanalytics');
const CARDBG = require('../models/cardBg');
const DEVICE = require('../models/device');
const TEMP = require('../models/temp');
const ECARDBG = require('../models/emotionCardBg');
const HCARDBG = require('../models/hotnessCardBg');
const FCARDBG = require('../models/friendCardBg');
const BCARDBG = require('../models/bluffCardBg');
const HOTNESSCATEGORY = require('../models/hotnessCategory');
const EMOJI = require('../models/emotionEmoji');
const CONTENT = require('../models/emotionContent');
const CHALLENGECONTENT = require('../models/challengeContent');
const COLLAB = require('../models/collab');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const { v4: uuidv4 } = require("uuid");
const crypto = require('crypto');
const SECRET_KEY = 'LOL-KEY';

const { google } = require("googleapis");
const axios = require("axios");
const cheerio = require("cheerio");

// APPLE CONFIG
const APPLE_SHARED_SECRET = process.env.APPLE_SHARED_SECRET;

// ---- Verify Google
async function verifyGooglePurchase(packageName, subscriptionId = "weekly_premium", purchaseToken) {
    const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
        scopes: ["https://www.googleapis.com/auth/androidpublisher"],
    });

    const client = await auth.getClient();
    const androidPublisher = google.androidpublisher({ version: "v3", auth: client });

    try {
        // Correct call: purchaseToken must be in the "token" path param
        const res = await androidPublisher.purchases.subscriptionsv2.get({
            packageName,
            token: purchaseToken,  // required path parameter
        });

        // console.log(res.data.lineItems);

        const data = res.data;
        // console.log("Subscription State:", data.subscriptionState);
        return data;
    } catch (error) {
        console.error("Failed to verify subscription:", error.response?.data || error.message);
        throw error;
    }
}

// ---- Verify Apple
function generateAppleJWT() {
    const privateKey = fs.readFileSync('SubscriptionKey_8F8MSHUT5F.p8');

    return jwt.sign(
        {
            iss: process.env.APPLE_ISSUER_ID,       // Issuer ID
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 1200,
            aud: 'appstoreconnect-v1',
            bid: process.env.APPLE_BUNDLE_ID
        },
        privateKey,
        {
            algorithm: 'ES256',
            header: {
                alg: 'ES256',
                kid: process.env.APPLE_KEY_ID,
                typ: 'JWT'
            }
        }
    );
}

async function verifyApplePurchase(originalTransactionId, id) {
    const token = generateAppleJWT();

    const PROD_URL = `https://api.storekit.itunes.apple.com/inApps/v1/subscriptions/${originalTransactionId}`;
    const SANDBOX_URL = `https://api.storekit-sandbox.itunes.apple.com/inApps/v1/subscriptions/${originalTransactionId}`;

    try {
        // Try Production first
        const prodResponse = await axios.get(PROD_URL, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        const groups = prodResponse.data.data; // Fixed: was sandboxResponse

        const status = groups[0]?.lastTransactions?.[0].status;

        const signedTransactionInfo = groups[0]?.lastTransactions?.[0].signedTransactionInfo;
        const decoded = jwt.decode(signedTransactionInfo);

        if (decoded) {
            await TEMP.create({
                EmailId: id,
                btransactionId: decoded.transactionId,
                bogTransactionId: decoded.originalTransactionId,
                bpurchaseDate: decoded.purchaseDate,
                bexDate: decoded.expiresDate,
                case: "-",
                bstatus: status,
            });
        }

        return status;

    } catch (error) {
        // If production fails, try sandbox
        if (error.response?.status === 404 || error.response?.status === 401) {
            const sandboxResponse = await axios.get(SANDBOX_URL, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const groups = sandboxResponse.data.data;
            const status = groups[0]?.lastTransactions?.[0].status;

            const signedTransactionInfo = groups[0]?.lastTransactions?.[0].signedTransactionInfo;
            const decoded = jwt.decode(signedTransactionInfo);

            if (decoded) {
                await TEMP.create({
                    EmailId: id,
                    btransactionId: decoded.transactionId,
                    bogTransactionId: decoded.originalTransactionId,
                    bpurchaseDate: decoded.purchaseDate,
                    bexDate: decoded.expiresDate,
                    case: "-",
                    bstatus: status,
                });
            }


            return status;
        }

        throw error;
    }
}

//====== User =======


exports.CallBack = async function (req, res, next) {
    try {
        const authorizationCode = req.query.code;

        if (!authorizationCode) {
            throw new Error("Authorization code not provided");
        }

        // Exchange authorization code for access token
        const res = await axios.post('https://accounts.snapchat.com/accounts/oauth2/token', {
            client_id: '19349384-4e7f-4b06-97b5-541b61807287',
            client_secret: 'dccd7c34d3bbf2e6716f',
            code: authorizationCode,
            grant_type: 'authorization_code',
            redirect_uri: 'https://api.lolcards.link/api/callback',
        });

        // https://accounts.snapchat.com/login/oauth2/authorize?client_id=19349384-4e7f-4b06-97b5-541b61807287&redirect_uri=https://lolcards.link/api/callback&response_type=code&scope=snapchat-marketing-api

        // The res will contain the access token
        const { access_token, refresh_token } = res.data;

        res.status(200).json({
            status: 1,
            message: 'Data Updated Successfully',
            access_token,
            refresh_token
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};


// =========================== 2.O ================================
exports.Profile = async function (req, res, next) {
    try {
        const { id, username, language, deviceToken, deviceId, name } = req.body;

        if (req.file) {
            req.body.avatar = req.file.s3Url;
        } else if (req.body.avatarUrl) {
            req.body.avatar = req.body.avatarUrl;
        } else {
            req.body.avatar = "https://lol-image-bucket.s3.ap-south-1.amazonaws.com/AvatarDefault1.png";
        }

        if (!id || !username || !language || !deviceToken) {
            throw new Error('Enter all fields : id , language , username , deviceToken');
        }

        const baseLink = `lolcards.link/${username}`;
        if (!req.body.link || req.body.link === `lolcards.link/`) {
            // Check if link already exists in DB
            let uniqueLink = baseLink;
            let count = 1;

            const linkExists = async (link) => {
                const existing = await NUSER.findOne({ link: link });
                return !!existing;
            };

            while (await linkExists(uniqueLink)) {
                uniqueLink = `${baseLink}${count}`;
                count++;
            }

            req.body.link = uniqueLink;
        }

        // 👉 Ensure deviceToken is always stored as array
        req.body.deviceToken = [deviceToken];
        if (deviceId) {
            req.body.deviceId = [deviceId];
        }


        const dataCreate = await NUSER.create(req.body);

        const { _id, createdAt, updatedAt, __v, picroastcredit, ...otherData } = dataCreate.toObject();

        res.status(201).json({
            status: 1,
            message: "Registered successfully",
            data: {
                ...otherData,
                deviceToken: req.body.deviceToken[0] || "",
            }
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message
        });
    }
};

exports.IdExist = async function (req, res, next) {
    try {
        if (!req.body.id) {
            throw new Error("id value is required");
        }

        // if (!req.body.deviceId) {
        //     throw new Error("deviceId is required")
        // }

        const userData = await NUSER.findOne({ id: req.body.id });

        // Always generate token from jwt
        const payload = { id: req.body.id };
        const token = `Bearer ${jwt.sign(payload, SECRET_KEY)}`;

        if (userData) {
            if (req.body.deviceToken) {
                const exists = userData.deviceToken.some(token => token === req.body.deviceToken);
                if (!exists) {
                    userData.deviceToken.push(req.body.deviceToken);
                    await userData.save();
                }
            }

            if (req.body.deviceId) {
                const exists = userData.deviceId.some(token => token === req.body.deviceId);
                if (!exists) {
                    userData.deviceId.push(req.body.deviceId);
                    await userData.save();
                }
            }
            const { _id, createdAt, updatedAt, __v, picroastcredit, deviceToken, deviceId, ...otherData } = userData.toObject();


            let response = {
                UserIdStatus: false,
                message: 'Authentication Id Exists',
                token: token
            };

            if (req.body.platform) {
                const premium = await PREMIUM.findOne({ isActive: true })
                if (req.body.lan === "hi") {
                    response.premiumtitle = premium.hiTitle || null;
                } else if (req.body.lan === "es") {
                    response.premiumtitle = premium.esTitle || null;
                } else {
                    response.premiumtitle = premium.title || null;
                }
                response.premiumid = req.body.platform === "android" ? premium.androidId : premium.iosId
                response.data = {
                    ...otherData,
                    deviceToken: req.body.deviceToken || userData.deviceToken[0] || ""
                }
            } else {
                response.data = {
                    ...otherData,
                    deviceToken: req.body.deviceToken || userData.deviceToken[0] || ""
                }
            }

            res.status(200).json(response);
        } else {
            let response = {
                UserIdStatus: true,
                message: 'Authentication Id Not Exists',
                token: token
            };

            if (req.body.platform) {
                const premium = await PREMIUM.findOne({ isActive: true })
                if (req.body.lan === "hi") {
                    response.premiumtitle = premium.hiTitle || null;
                } else if (req.body.lan === "es") {
                    response.premiumtitle = premium.esTitle || null;
                } else {
                    response.premiumtitle = premium.title || null;
                }
                response.premiumid = req.body.platform === "android" ? premium.androidId : premium.iosId
            }

            res.status(200).json(response);
        }
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};


exports.ProfileUpdate = async function (req, res, next) {
    try {
        if (req.file) {
            req.body.avatar = req.file.s3Url
        } else if (req.body.avatarUrl) {
            req.body.avatar = req.body.avatarUrl;
        } else {
            req.body.avatar = "https://lol-image-bucket.s3.ap-south-1.amazonaws.com/AvatarDefault1.png";
        }
        const { id } = req.body;

        const dataUpdate = await NUSER.findOneAndUpdate({ id: id }, req.body, { new: true });

        if (!dataUpdate) {
            throw new Error("id not found");
        }

        const { _id, createdAt, updatedAt, __v, ...otherData } = dataUpdate.toObject();
        res.status(200).json({
            status: 1,
            message: "Profile Updated successfully",
            data: dataUpdate.avatar
        });

    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message
        });
    }
};

exports.UpdateLink2 = async function (req, res, next) {
    try {

        const { id, pauseLink } = req.body;

        if (!id || !pauseLink) {
            throw new Error("id and pauseLink are required");
        }

        const dataUpdate = await NUSER.findOneAndUpdate({ id: id }, req.body, { new: true });
        if (!dataUpdate) {
            throw new Error('User not found');
        }

        res.status(200).json({
            status: 1,
            message: 'Data Updated Successfully',
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};

exports.PauseLink = async function (req, res, next) {
    try {
        const { id, pauseLink, timeperiod } = req.body;

        if (!id || pauseLink === undefined || !timeperiod) {
            throw new Error("id , timeperiod and pauseLink are required");
        }

        // Prepare the update object
        const updateData = { pauseLink, timeperiod };

        let expiryTimeInMs = null;

        // If timeperiod exists (1, 6, or 24), calculate expiry time
        if (timeperiod > 0) {
            const now = Date.now();
            expiryTimeInMs = now + timeperiod * 60 * 60 * 1000; // Convert hours to milliseconds 

            updateData.expiryTime = expiryTimeInMs;
        }


        let dataUpdate = await NUSER.findOneAndUpdate({ id }, updateData, { new: true });

        if (!dataUpdate) {
            throw new Error('User not found');
        }

        // ✅ Auto-reset after timeperiod hours
        if (expiryTimeInMs) {
            setTimeout(async () => {
                try {
                    dataUpdate.pauseLink = false;   // Disable pauseLink
                    dataUpdate.expiryTime = null;   // Disable pauseLink
                    dataUpdate.timeperiod = -1;   // Clear expiry time
                    await dataUpdate.save();
                    console.log(`✅ pauseLink reset for user ${id}`);
                } catch (error) {
                    console.error('❌ Auto-reset error:', error.message);
                }
            }, timeperiod * 60 * 60 * 1000); // Convert hours to milliseconds
        }

        res.status(200).json({
            status: 1,
            message: 'Data Updated Successfully'
        });

    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};


// exports.PauseLink = async function (req, res, next) {
//     try {
//         const { id, pauseLink, timeperiod } = req.body;

//         if (!id || pauseLink === undefined || timeperiod === undefined) {
//             throw new Error("id, pauseLink, and timeperiod are required");
//         }

//         const updateData = { pauseLink, timeperiod };
//         let expiryTimeInMs = null;

//         if (typeof timeperiod === 'number' && timeperiod > 0) {
//             const now = Date.now();
//             expiryTimeInMs = now + timeperiod * 60 * 60 * 1000; // Convert hours → ms
//             updateData.expiryTime = expiryTimeInMs;
//         } else {
//             updateData.expiryTime = null; // clear if no timeperiod
//         }

//         const dataUpdate = await NUSER.findOneAndUpdate({ id }, updateData, { new: true });

//         if (!dataUpdate) {
//             throw new Error('User not found');
//         }

//         res.status(200).json({
//             status: 1,
//             message: 'Data Updated Successfully'
//         });

//     } catch (error) {
//         res.status(400).json({
//             status: 0,
//             message: error.message
//         });
//     }
// };


exports.Purchase2 = async function (req, res, next) {
    try {
        if (!req.body.id) {
            throw new Error("id value is required");
        }

        let purchasestatus = "false";
        let purchaseId = null;
        let transactionId = null;

        if (req.body.platform === "android") {
            // Static values
            const packageName = "com.lol.android";
            let subscriptionId = req.body.subscriptionId || "monthly_premium";
            const purchaseToken = req.body.purchasedata

            if (purchaseToken) {
                const verifyResult = await verifyGooglePurchase(packageName, subscriptionId, purchaseToken);
                const lineItem = verifyResult.lineItems?.[0];
                if (lineItem?.expiryTime) {
                    const expiryDate = new Date(lineItem.expiryTime);
                    purchasestatus = expiryDate > new Date() ? "true" : "false";
                }
                purchaseId = purchaseToken;
                subscriptionId = subscriptionId;
            }

            await NUSER.findOneAndUpdate(
                { id: req.body.id },
                { isPurchase: purchasestatus, purchaseId, subscriptionId },
                { new: true }
            );
        }

        if (req.body.platform === "ios") {
            const receiptData = req.body.purchasedata
            if (receiptData) {
                const verifyResult = await verifyApplePurchase(receiptData, req.body.id);
                purchasestatus = (verifyResult === 1 || verifyResult === 3) ? "true" : "false";
                purchaseId = receiptData;
            }

            await NUSER.findOneAndUpdate(
                { id: req.body.id },
                { isPurchase: purchasestatus, purchaseId },
                { new: true }
            );


            if (purchasestatus === "false") {
                await NUSER.updateMany(
                    {
                        purchaseId: req.body.purchasedata
                    },
                    {
                        $set: {
                            purchaseId: null,
                            isPurchase: false
                        }
                    }
                );
            }
        }

        res.status(200).json({
            status: 1,
            message: 'User-Purchase Update Successfully',
            purchasestatus: purchasestatus
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};


// ===================================== 1 ques preview api =======================================
exports.StaticQue = async function (req, res, next) {
    try {
        const { id, categoryname, question, answer, lan } = req.body;

        if (!categoryname || !question || !answer || !lan) {
            throw new Error('categoryname, answer, lan & question value is required');
        }

        const user = await NUSER.findOne({ id: id });
        if (!user) {
            throw new Error('User not found');
        }

        let updated = false;

        // Ensure user.question is an array
        if (!Array.isArray(user.question)) {
            user.question = [];
        }

        // Check if category exists
        user.question = user.question.map(q => {
            if (q.category === categoryname) {
                updated = true;
                return {
                    category: categoryname,
                    question: question,
                    answer: answer, // Store whatever object is sent
                    lan: lan
                };
            }
            return q;
        });

        // If category not found, push new category-question pair
        if (!updated) {
            user.question.push({
                category: categoryname,
                question: question,
                answer: answer, // Store whatever object is sent
                lan: lan
            });
        }

        await user.save();

        res.status(200).json({
            status: 1,
            message: updated
                ? 'Question Updated Successfully'
                : 'New Category and Question Added Successfully',
        });

    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};

// ============================= 1 and 2 merge question preview api ========================================

exports.StaticQueUpdate = async function (req, res, next) {
    try {
        const { id, categoryname, question, lan, picroastcredit, timestamp, quetype } = req.body;

        if (!categoryname || !question || !lan) {
            throw new Error('categoryname, lan & question value is required');
        }

        const user = await NUSER.findOne({ id: id });
        if (!user) {
            throw new Error('User not found');
        }
        // =================== share count update

        const categoryDoc = await CATEGORY.findOne({ 'category.name': categoryname });

        if (categoryDoc) {
            const deviceIds = await DEVICE.find().select("deviceId -_id");
            const idList = deviceIds.map(d => d.deviceId);
            const alreadyShared = idList.some(id => user.deviceId.includes(id));
            if (!alreadyShared) {
                // share increment only once per device
                const today = new Date().toISOString().split("T")[0];
                await CATEGORYANALYTICS.findOneAndUpdate(
                    { date: today, category: categoryname },
                    { $inc: { share: 1 } },
                    { upsert: true, new: true }
                );
            }
        }

        // ======================

        let updated = false;

        if (categoryname === 'UGljIFJvYXN0') {
            if (!picroastcredit || !timestamp || !quetype) {
                throw new Error('picroastcredit , quetype & timestamp value is required');
            }
        }

        // ✅ Handle picroastcredit logic
        if (typeof picroastcredit !== "undefined") {
            const num = Number(picroastcredit);

            if (num === 1) {
                user.picroastcredit = user.picroastcredit - 1;
            } else if (num === 0) {
                user.picroastcredit = user.picroastcredit - 0;
            }
        }

        // Ensure user.question is an array
        if (!Array.isArray(user.question)) {
            user.question = [];
        }

        // Build answer object
        let answerObj = {
            word: req.body.word,
            image: req.file ? req.file.s3Url : null,
            timestamp: req.body.timestamp,
            quetype: req.body.quetype,
            thumbnailUrl: req.file ? req.file.thumbnailUrl : null,
            prankname: req.body.prankname
        };

        if (categoryname === 'UGljIFJvYXN0') {
            user.question.push({
                category: categoryname,
                question: question,
                answer: answerObj,
                lan: lan
            });
        } else {
            // Update if category exists
            user.question = user.question.map(q => {
                if (q.category === categoryname) {
                    updated = true;
                    return {
                        category: categoryname,
                        question: question,
                        answer: answerObj,
                        lan: lan
                    };
                }
                return q;
            });

            // If category not found, push new
            if (!updated) {
                user.question.push({
                    category: categoryname,
                    question: question,
                    answer: answerObj,
                    lan: lan
                });
            }
        }

        await user.save();

        res.status(200).json({
            status: 1,
            message: updated
                ? 'Question Updated Successfully'
                : 'New Category and Question Added Successfully'
        });

    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};

exports.CreditGet = async function (req, res, next) {
    try {
        const { id } = req.body;

        const user = await NUSER.findOne({ id: id });

        if (!user) {
            throw new Error('User not found');
        }

        res.status(200).json({
            status: 1,
            message: 'Credit Found Successfully',
            picroastcredit: user.picroastcredit   // 👈 add this
        });

    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};

// ======================== 3 question =================================
const annoyQuestions = {
    en: [
        "Weird Talent",
        "Hobby",
        "Jolly Memory",
        "Secret",
        "Hidden Skill",
        "Mood",
        "Guilty Pleasure",
        "Crush Vibes",
        "Jolly Addiction",
        "Funny Dream",
        "Antic Phobia",
        "Carbon Copy",
        "Antic Work",
        "Fantasy Mystery",
        "Antic Crush"
    ],
    es: [
        "Talento raro",
        "Pasatiempo",
        "Recuerdo alegre",
        "Secreto",
        "Habilidad oculta",
        "Estado de ánimo",
        "Placer culposo",
        "Vibras de crush",
        "Adicción divertida",
        "Sueño divertido",
        "Fobia rara",
        "Copia exacta",
        "Trabajo raro",
        "Misterio fantasioso",
        "Crush antiguo"
    ],
    hi: [
        "अजीब टैलेंट",
        "शौक",
        "मजेदार याद",
        "राज़",
        "छिपी हुई कला",
        "मूड",
        "गिल्टी प्लेजर",
        "क्रश वाइब्स",
        "मजेदार लत",
        "मजेदार सपना",
        "अजीब फोबिया",
        "हूबहू कॉपी",
        "अनोखा काम",
        "फैंटेसी मिस्ट्री",
        "पुराना क्रश"
    ]
};


function getRandomIndexes(total, count) {
    const used = new Set();
    while (used.size < Math.min(count, total)) {
        used.add(Math.floor(Math.random() * total));
    }
    return [...used];
}


exports.Annoy = async function (req, res, next) {
    try {
        const { id, categoryname, question, lan, cardtitle1, cardtitle2, cardtitle3, cardtitle4 } = req.body;

        if (!categoryname || !question || !lan || !cardtitle1 || !cardtitle2 || !cardtitle3 || !cardtitle4) {
            throw new Error('categoryname, lan , cardtitle1 , cardtitle2 , cardtitle3 , cardtitle4 & question value is required');
        }

        const user = await NUSER.findOne({ id: id });
        if (!user) {
            throw new Error('User not found');
        }

        // =================== share count update

        const categoryDoc = await CATEGORY.findOne({ 'category.name': categoryname });

        if (categoryDoc) {
            const deviceIds = await DEVICE.find().select("deviceId -_id");
            const idList = deviceIds.map(d => d.deviceId);
            const alreadyShared = idList.some(id => user.deviceId.includes(id));
            if (!alreadyShared) {
                // share increment only once per device
                const today = new Date().toISOString().split("T")[0];
                await CATEGORYANALYTICS.findOneAndUpdate(
                    { date: today, category: categoryname },
                    { $inc: { share: 1 } },
                    { upsert: true, new: true }
                );
            }
        }

        // ======================

        let updated = false;

        // Ensure user.question is an array
        if (!Array.isArray(user.question)) {
            user.question = [];
        }

        // Build answer object
        let answerObj = {
            annoycardtitle: [cardtitle1, cardtitle2, cardtitle3, cardtitle4]
        };

        user.question = user.question.map(q => {
            if (q.category === categoryname) {
                updated = true;
                return {
                    category: categoryname,
                    question: question,
                    answer: answerObj, // Store whatever object is sent
                    lan: lan
                };
            }
            return q;
        });

        // If category not found, push new
        if (!updated) {
            user.question.push({
                category: categoryname,
                question: question,
                answer: answerObj,
                lan: lan
            });
        }


        await user.save();

        res.status(200).json({
            status: 1,
            message: updated
                ? 'Question Updated Successfully'
                : 'New Category and Question Added Successfully'
        });

    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};


exports.AnnoyCardtitle = async function (req, res, next) {
    try {
        const { id, lan } = req.body;

        // ✅ Find user
        const user = await NUSER.findOne({ id });
        if (!user) throw new Error('User not found');

        // ✅ Determine language
        const lang = (lan && annoyQuestions[lan]) ? lan : 'en';

        // ✅ Merge default & user questions
        const selectedQuestions = [
            ...(user.annoyallcardtitle ? [...user.annoyallcardtitle] : []),
            ...annoyQuestions[lang],
        ];

        let selectedindex = [];

        // ✅ Handle logic based on purchase
        if (!user.isPurchase) {
            selectedindex = getRandomIndexes(selectedQuestions.length, 4);
        } else {
            const fixed = user.question.filter(q => q.category === 'QW5ub3kgZnVuIENhcmQ=');

            fixed.forEach(item => {
                if (item.answer?.annoycardtitle?.length) {
                    selectedindex.push(...item.answer.annoycardtitle);
                }
            });

            if (!selectedindex.length) {
                const fixedIndex = 0;

                // Generate 3 random indexes EXCEPT 0
                const randomIndexes = getRandomIndexes(
                    selectedQuestions.length,
                    3,
                    [fixedIndex]  // exclude 0
                );

                selectedindex = [fixedIndex, ...randomIndexes];
            }
        }

        // ✅ Response
        res.status(200).json({
            status: 1,
            message: "Questions fetched successfully",
            questions: selectedQuestions,
            selectedindex
        });

    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message
        });
    }
};


exports.AnnoyAddCardtitle = async function (req, res, next) {
    try {
        const { id, cardtitle } = req.body;

        const user = await NUSER.findOne({ id });
        if (!user) throw new Error('User not found');

        // Check if user has purchased
        if (!user.isPurchase) {
            throw new Error('User has not purchased, cannot edit cardtitle');
        }

        // Ensure cardtitle is an array
        const cardtitleToAdd = Array.isArray(cardtitle) ? cardtitle : [cardtitle];

        // Add at FRONT instead of END
        user.annoyallcardtitle.unshift(...cardtitleToAdd);

        const fixed = user.question.find(q => q.category === 'QW5ub3kgZnVuIENhcmQ=');

        if (fixed?.answer?.annoycardtitle) {
            const updated = fixed.answer.annoycardtitle.map((num, index) => {
                if (index === 0) return 0;
                return num + 1;
            });

            fixed.answer.annoycardtitle = updated;
        }


        // Save user
        await user.save();

        // Response
        res.status(200).json({
            status: 1,
            message: "Cardtitle edited successfully",
        });

    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message
        });
    }
};

// =============================== 4 question ===============================
exports.Emotion = async function (req, res, next) {
    try {
        const { id, categoryname, question, lan, word } = req.body;

        if (!categoryname || !question || !lan || !word) {
            throw new Error('categoryname, lan , word & question value is required');
        }

        const user = await NUSER.findOne({ id: id });
        if (!user) {
            throw new Error('User not found');
        }

        // =================== share count update =====================

        const categoryDoc = await CATEGORY.findOne({ 'category.name': categoryname });

        if (categoryDoc) {
            const deviceIds = await DEVICE.find().select("deviceId -_id");
            const idList = deviceIds.map(d => d.deviceId);
            const alreadyShared = idList.some(id => user.deviceId.includes(id));
            if (!alreadyShared) {
                // share increment only once per device
                const today = new Date().toISOString().split("T")[0];
                await CATEGORYANALYTICS.findOneAndUpdate(
                    { date: today, category: categoryname },
                    { $inc: { share: 1 } },
                    { upsert: true, new: true }
                );
            }
        }


        // =========================================================

        let updated = false;

        // Ensure user.question is an array
        if (!Array.isArray(user.question)) {
            user.question = [];
        }

        // Build answer object
        let answerObj = {
            speakWord: req.body.word
        };

        user.question = user.question.map(q => {
            if (q.category === categoryname) {
                updated = true;
                return {
                    category: categoryname,
                    question: question,
                    answer: answerObj, // Store whatever object is sent
                    lan: lan
                };
            }
            return q;
        });

        // If category not found, push new
        if (!updated) {
            user.question.push({
                category: categoryname,
                question: question,
                answer: answerObj,
                lan: lan
            });
        }


        await user.save();

        res.status(200).json({
            status: 1,
            message: updated
                ? 'Question Updated Successfully'
                : 'New Category and Question Added Successfully'
        });

    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};

// =============================== 5 question ===============================
exports.Confession = async function (req, res, next) {
    try {
        const { id, categoryname, question, lan } = req.body;

        if (!categoryname || !question || !lan) {
            throw new Error('categoryname, lan & question value is required');
        }

        const user = await NUSER.findOne({ id: id });
        if (!user) {
            throw new Error('User not found');
        }

        // =================== share count update =====================

        const categoryDoc = await CATEGORY.findOne({ 'category.name': categoryname });

        if (categoryDoc) {
            const deviceIds = await DEVICE.find().select("deviceId -_id");
            const idList = deviceIds.map(d => d.deviceId);
            const alreadyShared = idList.some(id => user.deviceId.includes(id));
            if (!alreadyShared) {
                // share increment only once per device
                const today = new Date().toISOString().split("T")[0];
                await CATEGORYANALYTICS.findOneAndUpdate(
                    { date: today, category: categoryname },
                    { $inc: { share: 1 } },
                    { upsert: true, new: true }
                );
            }
        }


        // =========================================================

        let updated = false;

        // Ensure user.question is an array
        if (!Array.isArray(user.question)) {
            user.question = [];
        }
        // Build answer object
        const isQuestion = categoryname === "UXVlc3Rpb24=";

        let answerObj = {
            confessionTitle:
                lan === "hi"
                    ? (isQuestion ? "प्रश्न" : "कन्फेशन")
                    : lan === "es"
                        ? (isQuestion ? "Pregunta" : "Confesión")
                        : (isQuestion ? "Question" : "Confession")
        };

        user.question = user.question.map(q => {
            if (q.category === "Q29uZmVzc2lvbg==") {
                updated = true;
                return {
                    category: "Q29uZmVzc2lvbg==",
                    question: question,
                    answer: answerObj, // Store whatever object is sent
                    lan: lan
                };
            }
            return q;
        });

        // If category not found, push new
        if (!updated) {
            user.question.push({
                category: "Q29uZmVzc2lvbg==",
                question: question,
                answer: answerObj,
                lan: lan
            });
        }


        await user.save();

        res.status(200).json({
            status: 1,
            message: updated
                ? 'Question Updated Successfully'
                : 'New Category and Question Added Successfully'
        });

    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};

// =============================== 6 question ===============================
exports.HotnessCategory = async function (req, res) {
    try {
        const { lan, page } = req.body;

        if (!lan) {
            throw new Error('lan value is required');
        }

        // 🔹 page comes as string → convert to number
        const currentPage = Number(page) || 1;
        const limit = 5;
        const skip = (currentPage - 1) * limit;

        const data = await HOTNESSCATEGORY.find().lean();
        const result = {};

        data.forEach(item => {
            let categoryTitle;
            let subCategoryTitle;

            if (lan === 'hi') {
                categoryTitle = item.hicategoryTitle || item.categoryTitle;
                subCategoryTitle = item.hisubCatergoryTitle || item.subCatergoryTitle;
            } else if (lan === 'es') {
                categoryTitle = item.escategoryTitle || item.categoryTitle;
                subCategoryTitle = item.essubCatergoryTitle || item.subCatergoryTitle;
            } else {
                categoryTitle = item.categoryTitle;
                subCategoryTitle = item.subCatergoryTitle;
            }

            const key = `${categoryTitle}_${item.categoryImage}`;

            if (!result[key]) {
                result[key] = {
                    categoryId: item.categoryId,
                    categoryTitle,
                    categoryImage: item.categoryImage,
                    subcategories: []
                };
            }

            result[key].subcategories.push({
                title: subCategoryTitle,
                image: item.subCatergoryImage
            });
        });

        // 🔹 ONLY categories with exactly 8 subcategories
        const finalData = Object.values(result).filter(
            category => category.subcategories.length === 8
        );

        // 🔹 Pagination logic
        let paginatedData = finalData.slice(skip, skip + limit);

        if (Number(page) === 1) {
            paginatedData = paginatedData.sort(() => Math.random() - 0.5);
        }


        // 🔹 If page has no data
        if (paginatedData.length === 0) {
            return res.status(200).json({
                status: 0,
                message: "No data found on this page"
            });
        }

        res.status(200).json({
            status: 1,
            message: "Category Find Successfully",
            data: paginatedData
        });

    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};



exports.Hotness = async function (req, res, next) {
    try {
        const { id, categoryname, question, lan, hotnessId } = req.body;

        if (!categoryname || !question || !lan || !hotnessId) {
            throw new Error('categoryname, lan , hotnessId & question value is required');
        }

        const user = await NUSER.findOne({ id: id });
        if (!user) {
            throw new Error('User not found');
        }

        // =================== share count update =====================

        const categoryDoc = await CATEGORY.findOne({ 'category.name': categoryname });

        if (categoryDoc) {
            const deviceIds = await DEVICE.find().select("deviceId -_id");
            const idList = deviceIds.map(d => d.deviceId);
            const alreadyShared = idList.some(id => user.deviceId.includes(id));
            if (!alreadyShared) {
                // share increment only once per device
                const today = new Date().toISOString().split("T")[0];
                await CATEGORYANALYTICS.findOneAndUpdate(
                    { date: today, category: categoryname },
                    { $inc: { share: 1 } },
                    { upsert: true, new: true }
                );
            }
        }


        // =========================================================

        let updated = false;

        // Ensure user.question is an array
        if (!Array.isArray(user.question)) {
            user.question = [];
        }

        // Build answer object
        let answerObj = {
            hotnessId: Number(req.body.hotnessId)
        };

        user.question = user.question.map(q => {
            if (q.category === categoryname) {
                updated = true;
                return {
                    category: categoryname,
                    question: question,
                    answer: answerObj, // Store whatever object is sent
                    lan: lan
                };
            }
            return q;
        });

        // If category not found, push new
        if (!updated) {
            user.question.push({
                category: categoryname,
                question: question,
                answer: answerObj,
                lan: lan
            });
        }


        await user.save();

        res.status(200).json({
            status: 1,
            message: updated
                ? 'Question Updated Successfully'
                : 'New Category and Question Added Successfully'
        });

    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};

// =============================== 7 question ===============================
exports.FrndLove = async function (req, res, next) {
    try {
        const { id, categoryname, question, lan } = req.body;

        if (!categoryname || !question || !lan) {
            throw new Error('categoryname, lan & question value is required');
        }

        const user = await NUSER.findOne({ id: id });
        if (!user) {
            throw new Error('User not found');
        }

        // =================== share count update =====================

        const categoryDoc = await CATEGORY.findOne({ 'category.name': categoryname });

        if (categoryDoc) {
            const deviceIds = await DEVICE.find().select("deviceId -_id");
            const idList = deviceIds.map(d => d.deviceId);
            const alreadyShared = idList.some(id => user.deviceId.includes(id));
            if (!alreadyShared) {
                // share increment only once per device
                const today = new Date().toISOString().split("T")[0];
                await CATEGORYANALYTICS.findOneAndUpdate(
                    { date: today, category: categoryname },
                    { $inc: { share: 1 } },
                    { upsert: true, new: true }
                );
            }
        }


        // =========================================================

        let updated = false;

        // Ensure user.question is an array
        if (!Array.isArray(user.question)) {
            user.question = [];
        }

        let answerObj = {
            subCategory: categoryname
        };

        user.question = user.question.map(q => {
            if (q.category === "RnJpZW5k") {
                updated = true;
                return {
                    category: "RnJpZW5k",
                    question: question,
                    answer: answerObj,
                    lan: lan
                };
            }
            return q;
        });

        // If category not found, push new
        if (!updated) {
            user.question.push({
                category: "RnJpZW5k",
                question: question,
                answer: answerObj,
                lan: lan
            });
        }


        await user.save();

        res.status(200).json({
            status: 1,
            message: updated
                ? 'Question Updated Successfully'
                : 'New Category and Question Added Successfully'
        });

    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};

// =============================== 8 question ===============================
exports.Roast = async function (req, res, next) {
    try {
        const { id, categoryname, question, lan } = req.body;

        if (!categoryname || !question || !lan) {
            throw new Error('categoryname, lan & question value is required');
        }

        const user = await NUSER.findOne({ id: id });
        if (!user) {
            throw new Error('User not found');
        }

        // =================== share count update =====================

        const categoryDoc = await CATEGORY.findOne({ 'category.name': categoryname });

        if (categoryDoc) {
            const deviceIds = await DEVICE.find().select("deviceId -_id");
            const idList = deviceIds.map(d => d.deviceId);
            const alreadyShared = idList.some(id => user.deviceId.includes(id));
            if (!alreadyShared) {
                // share increment only once per device
                const today = new Date().toISOString().split("T")[0];
                await CATEGORYANALYTICS.findOneAndUpdate(
                    { date: today, category: categoryname },
                    { $inc: { share: 1 } },
                    { upsert: true, new: true }
                );
            }
        }


        // =========================================================

        let updated = false;

        // Ensure user.question is an array
        if (!Array.isArray(user.question)) {
            user.question = [];
        }

        user.question = user.question.map(q => {
            if (q.category === "Um9hc3Q=") {
                updated = true;
                return {
                    category: "Um9hc3Q=",
                    question: question,
                    lan: lan
                };
            }
            return q;
        });

        // If category not found, push new
        if (!updated) {
            user.question.push({
                category: "Um9hc3Q=",
                question: question,
                lan: lan
            });
        }


        await user.save();

        res.status(200).json({
            status: 1,
            message: updated
                ? 'Question Updated Successfully'
                : 'New Category and Question Added Successfully'
        });

    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};

// =============================== 9 question ===============================
exports.Bluff = async function (req, res, next) {
    try {
        const { id, categoryname, question, lan } = req.body;

        if (!categoryname || !question || !lan) {
            throw new Error('categoryname, lan & question value is required');
        }

        const user = await NUSER.findOne({ id: id });
        if (!user) {
            throw new Error('User not found');
        }

        // =================== share count update =====================

        const categoryDoc = await CATEGORY.findOne({ 'category.name': categoryname });

        if (categoryDoc) {
            const deviceIds = await DEVICE.find().select("deviceId -_id");
            const idList = deviceIds.map(d => d.deviceId);
            const alreadyShared = idList.some(id => user.deviceId.includes(id));
            if (!alreadyShared) {
                // share increment only once per device
                const today = new Date().toISOString().split("T")[0];
                await CATEGORYANALYTICS.findOneAndUpdate(
                    { date: today, category: categoryname },
                    { $inc: { share: 1 } },
                    { upsert: true, new: true }
                );
            }
        }


        // =========================================================

        let updated = false;

        // Ensure user.question is an array
        if (!Array.isArray(user.question)) {
            user.question = [];
        }

        user.question = user.question.map(q => {
            if (q.category === "Qmx1ZmY=") {
                updated = true;
                return {
                    category: "Qmx1ZmY=",
                    question: question,
                    lan: lan
                };
            }
            return q;
        });

        // If category not found, push new
        if (!updated) {
            user.question.push({
                category: "Qmx1ZmY=",
                question: question,
                lan: lan
            });
        }


        await user.save();

        res.status(200).json({
            status: 1,
            message: updated
                ? 'Question Updated Successfully'
                : 'New Category and Question Added Successfully'
        });

    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};

// =============================== 10 question ===============================
exports.Challenge = async function (req, res, next) {
    try {
        const { id, categoryname, question, lan } = req.body;

        if (!categoryname || !question || !lan) {
            throw new Error('categoryname, lan & question value is required');
        }

        const user = await NUSER.findOne({ id: id });
        if (!user) {
            throw new Error('User not found');
        }

        // =================== share count update =====================

        const categoryDoc = await CATEGORY.findOne({ 'category.name': categoryname });

        if (categoryDoc) {
            const deviceIds = await DEVICE.find().select("deviceId -_id");
            const idList = deviceIds.map(d => d.deviceId);
            const alreadyShared = idList.some(id => user.deviceId.includes(id));
            if (!alreadyShared) {
                // share increment only once per device
                const today = new Date().toISOString().split("T")[0];
                await CATEGORYANALYTICS.findOneAndUpdate(
                    { date: today, category: categoryname },
                    { $inc: { share: 1 } },
                    { upsert: true, new: true }
                );
            }
        }


        // =========================================================

        let updated = false;

        // Ensure user.question is an array
        if (!Array.isArray(user.question)) {
            user.question = [];
        }

        user.question = user.question.map(q => {
            if (q.category === "Q2hhbGxlbmdl") {
                updated = true;
                return {
                    category: "Q2hhbGxlbmdl",
                    question: question,
                    lan: lan
                };
            }
            return q;
        });

        // If category not found, push new
        if (!updated) {
            user.question.push({
                category: "Q2hhbGxlbmdl",
                question: question,
                lan: lan
            });
        }


        await user.save();

        res.status(200).json({
            status: 1,
            message: updated
                ? 'Question Updated Successfully'
                : 'New Category and Question Added Successfully'
        });

    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};


// ==============================================================================================


exports.DeleteUser = async function (req, res, next) {
    try {
        const { id } = req.body;

        const user = await NUSER.findOneAndDelete({ id: id });
        if (!user) {
            throw new Error('id not found');
        }

        await NINBOX.deleteMany({ id: id });


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
};

exports.BlockUser2 = async function (req, res, next) {
    try {
        const { id, block } = req.body;
        if (!id || !block) {
            throw new Error("id and block value are required")
        }

        const user = await NUSER.findOneAndUpdate(
            { id: id },
            { $addToSet: { blockList: block } },
            { new: true }
        );

        await NINBOX.deleteMany({
            ip: req.body.block,
            id: id
        });

        if (!user) {
            throw new Error("User Not Found")
        }

        res.status(200).json({
            status: 1,
            message: "User Blocked Successfully"
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};

exports.Logout = async function (req, res, next) {
    try {
        const { id, deviceToken } = req.body;
        if (!id || !deviceToken) {
            throw new Error("id and deviceToken value are required")
        }

        const user = await NUSER.findOneAndUpdate(
            { id: id },
            { $pull: { deviceToken: deviceToken } }, // 🔥 remove token from array
            { new: true }
        );

        if (!user) {
            throw new Error("User Not Found")
        }

        res.status(200).json({
            status: 1,
            message: "User Logout Successfully"
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};

// ======================= website ======================
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

        let block = false;
        if (user.blockList && user.blockList.includes(req.body.ip)) {
            block = true;
        }

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
                ? [...user.annoyallcardtitle, ...baseArray]
                : baseArray;

            // Step 3: Get indices and find values
            const indices = matched.answer?.annoycardtitle || [];
            const annoycardvalue = indices.map(index => mergedArray[index]).filter(Boolean);

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
            usernot: usernot,
            inboxDoc: responseData
        });

    } catch (error) {
        // console.log("CategoryWeb API Error:");
        // console.log("Message:", error.message);
        // console.log("Stack:", error.stack);
        // console.log("Body:", req.body);
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};


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

        // const getCategory = (d) =>
        //     d >= 0 && d <= 25 ? "Sad" :
        //         d <= 50 ? "Happy" :
        //             d <= 75 ? "Love" :
        //                 d <= 100 ? "Angry" : "Sad";

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

        const [CardBg, Emoji, Content] = await Promise.all([
            ECARDBG.aggregate([{ $match: { Category } }, { $sample: { size: 1 } }]),
            EMOJI.aggregate([{ $match: { Category } }, { $sample: { size: 1 } }]),
            CONTENT.aggregate([{ $match: { Category } }, { $sample: { size: 1 } }])
        ]);

        if (!CardBg[0] || !Emoji[0] || !Content[0]) {
            return res.status(400).json({ status: 0, message: "No data found for this category" });
        }

        res.status(200).json({
            status: 1,
            message: "Success",
            data: {
                CardBg: CardBg[0].CardBg,
                Emoji: Emoji[0].Emoji,
                Content: Content[0].Content,
                hiContent: Content[0].hiContent,
                esContent: Content[0].esContent,
            }
        });

    } catch (error) {
        res.status(400).json({ status: 0, message: error.message });
    }
};


exports.WebEmotionCardContent = async (req, res, next) => {
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

        const [Data] = await Promise.all([
            CONTENT.aggregate([{ $match: { Category } }, { $sample: { size: 1 } }])
        ]);

        if (!Data[0]) {
            return res.status(400).json({ status: 0, message: "No data found for this category" });
        }

        let Content;

        if (req.body.lanText === "hi") {
            Content = Data[0].hiContent;
        } else if (req.body.lanText === "es") {
            Content = Data[0].esContent;
        } else {
            Content = Data[0].Content;
        }

        res.status(200).json({
            status: 1,
            message: "Success",
            data: {
                Content: Content,
            }
        });


    } catch (error) {
        res.status(400).json({ status: 0, message: error.message });
    }
};


exports.WebChallengeCardContent = async (req, res, next) => {
    try {

        const [Data] = await Promise.all([
            CHALLENGECONTENT.aggregate([{ $sample: { size: 1 } }])
        ]);

        if (!Data[0]) {
            return res.status(400).json({ status: 0, message: "No data found" });
        }

        let Content;

        if (req.body.lanText === "hi") {
            Content = Data[0].hiContent;
        } else if (req.body.lanText === "es") {
            Content = Data[0].esContent;
        } else {
            Content = Data[0].Content;
        }

        res.status(200).json({
            status: 1,
            message: "Success",
            data: {
                Content: Content,
            }
        });


    } catch (error) {
        res.status(400).json({ status: 0, message: error.message });
    }
};


exports.WebHotnessCardPreview = async (req, res, next) => {
    try {

        const CardBg = await HCARDBG.aggregate([{ $sample: { size: 1 } }]);

        res.status(200).json({
            status: 1,
            message: "Success",
            data: {
                CardBg: CardBg[0].CardBg,
            }
        });

    } catch (error) {
        res.status(400).json({ status: 0, message: error.message });
    }
};


exports.WebFriendCardPreview = async (req, res, next) => {
    try {

        const CardBg = await FCARDBG.aggregate([{ $sample: { size: 1 } }]);

        res.status(200).json({
            status: 1,
            message: "Success",
            data: {
                CardBg: CardBg[0].CardBg,
            }
        });

    } catch (error) {
        res.status(400).json({ status: 0, message: error.message });
    }
};


exports.WebBluffCardPreview = async (req, res, next) => {
    try {

        const { category } = req.body;
        const CardBg = await BCARDBG.aggregate([
            {
                $match: { Category: category }
            },
            {
                $sample: { size: 1 }
            }
        ]);

        res.status(200).json({
            status: 1,
            message: "Success",
            data: {
                CardBg: CardBg[0]?.CardBg,
            }
        });

    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message
        });
    }
};


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
            if (!lanText || lanText === 'en') {
                obj.name = item.subCatergoryTitle;
            }
            // Hindi
            else if (lanText === 'hi') {
                obj.name = item.hisubCatergoryTitle || item.subCatergoryTitle;
            }
            // Spanish
            else if (lanText === 'es') {
                obj.name = item.essubCatergoryTitle || item.subCatergoryTitle;
            }
            // fallback for unknown language
            else {
                obj.name = item.subCatergoryTitle;
            }

            return obj;
        });

        const shuffleArray = (array) => {
            return array.sort(() => Math.random() - 0.5);
        };

        const shuffledData = shuffleArray(responseData);


        res.status(200).json({
            status: 1,
            message: "Success",
            data: shuffledData
        });

    } catch (error) {
        console.error('Error in WebRoastHostId:', error);
        res.status(500).json({
            status: 0,
            message: error.message
        });
    }
};





// =========================== purchase =====================
exports.Status = async function (req, res, next) {
    try {
        if (!req.body.id) {
            throw new Error("id value is required");
        }
        const { id } = req.body;
        let purchasestatus = "false";

        const userData = await NUSER.findOne({ id: req.body.id }).lean();
        const dbPurchaseId = userData ? userData.purchaseId : null;

        // Decide which purchaseId/receipt to use
        let purchaseDataToVerify = null;
        if (req.body.purchasedata && req.body.purchasedata === dbPurchaseId) {
            purchaseDataToVerify = req.body.purchasedata;   // use request value
        } else {
            purchaseDataToVerify = dbPurchaseId;            // fallback to DB value
        }

        if (req.body.platform === "android" && purchaseDataToVerify) {
            const packageName = "com.lol.android";
            const subscriptionId = userData.subscriptionId || "monthly_premium";

            const verifyResult = await verifyGooglePurchase(packageName, subscriptionId, purchaseDataToVerify);

            const expiryDate = new Date(parseInt(verifyResult.expiryTimeMillis));
            purchasestatus = expiryDate > new Date() ? "true" : "false";
        }

        if (req.body.platform === "ios" && purchaseDataToVerify) {
            const verifyResult = await verifyApplePurchase(purchaseDataToVerify);
            purchasestatus = (verifyResult === 1 || verifyResult === 3) ? "true" : "false";
        }


        if (req.body.platform === "ios" && purchasestatus === "false") {
            await NUSER.updateMany(
                {
                    purchaseId: req.body.purchasedata
                },
                {
                    $set: {
                        purchaseId: null,
                        isPurchase: false
                    }
                }
            );
        }

        let updateData = {
            isPurchase: purchasestatus
        };

        // If purchase is false → reset transactionId
        if (purchasestatus === "false") {
            updateData.transactionId = null;
        }

        await NUSER.updateOne(
            { id },
            { $set: updateData }
        );

        res.status(200).json({
            status: 1,
            message: 'Status Check Successfully',
            purchasestatus: purchasestatus,
            purchaseId: dbPurchaseId
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};

// exports.Verify = async function (req, res, next) {
//     try {
//         const { id } = req.body;

//         const user = await NUSER.findOne({ id: id }); // 👈 sirf findOne use karo
//         if (!user) {
//             return res.status(200).json({
//                 status: 0,
//                 message: 'User ID does not exist',
//                 userstatus: false
//             });
//         }

//         res.status(200).json({
//             status: 1,
//             message: 'User exists',
//             userstatus: true
//         });
//     } catch (error) {
//         res.status(400).json({
//             status: 0,
//             message: error.message,
//         });
//     }
// };


exports.Verify = async function (req, res, next) {
    try {
        if (!req.body.id) {
            throw new Error("id value is required");
        }
        const { id } = req.body;
        const premium = await PREMIUM.findOne({ isActive: true })
        const userData = await NUSER.findOne({ id: id }).lean(); // :point_left: sirf findOne use karo
        if (!userData) {
            return res.status(200).json({
                status: 0,
                message: 'User ID does not exist',
                userstatus: false
            });
        }

        const collabExists = await COLLAB.findOne({ id: id });

        // :white_check_mark: declare outside so available everywhere
        let purchasestatus = "false";
        let gracePeriod = "false";
        let dbPurchaseId = userData ? userData.purchaseId : null;
        if (req.body.platform) {
            // Decide which purchaseId/receipt to use
            let purchaseDataToVerify = null;
            if (req.body.purchasedata && req.body.purchasedata === dbPurchaseId) {
                purchaseDataToVerify = req.body.purchasedata;   // use request value
            } else {
                purchaseDataToVerify = dbPurchaseId;            // fallback to DB value
            }
            if (req.body.platform === "android" && purchaseDataToVerify) {
                const packageName = "com.lol.android";
                const subscriptionId = userData.subscriptionId || "weekly_premium";
                const verifyResult = await verifyGooglePurchase(packageName, subscriptionId, purchaseDataToVerify);
                const lineItem = verifyResult.lineItems?.[0];
                if (lineItem?.expiryTime) {
                    const expiryDate = new Date(lineItem.expiryTime);
                    purchasestatus = expiryDate > new Date() ? "true" : "false";
                    if (purchasestatus === "false") {
                        if (verifyResult.subscriptionState === "SUBSCRIPTION_STATE_IN_GRACE_PERIOD") {
                            purchasestatus = "true"
                            gracePeriod = "true"
                        }
                    }
                }
            }
            if (req.body.platform === "ios" && purchaseDataToVerify) {
                const verifyResult = await verifyApplePurchase(purchaseDataToVerify);
                purchasestatus = (verifyResult === 1 || verifyResult === 3 || verifyResult === 4) ? "true" : "false";
                if (verifyResult === 4) {
                    gracePeriod = "true"
                }
            }

        }
        if (req.body.platform === "ios" && purchasestatus === "false") {
            await NUSER.updateMany(
                {
                    purchaseId: req.body.purchasedata
                },
                {
                    $set: {
                        purchaseId: null,
                        isPurchase: false
                    }
                }
            );
        }

        let updateData = {
            isPurchase: purchasestatus
        };

        // If purchase is false → reset transactionId
        if (purchasestatus === "false") {
            updateData.transactionId = null;
        }

        await NUSER.updateOne(
            { id },
            { $set: updateData }
        );

        let response = {
            status: 1,
            message: 'User exists & Status Check Successfully',
            userstatus: true,
            collabsubmit: !!collabExists,
            timeperiod: userData
                ? userData.pauseLink
                    ? userData.timeperiod ?? 0
                    : -1
                : -1,
        };
        // jo platform hoy to j purchasestatus & purchaseId add karva
        if (req.body.platform) {
            response.purchasestatus = purchasestatus;
            response.gracePeriod = gracePeriod;
            response.purchaseId = dbPurchaseId ? dbPurchaseId : null;
            if (req.body.lan === "hi") {
                response.premiumtitle = premium.hiTitle || null;
            } else if (req.body.lan === "es") {
                response.premiumtitle = premium.esTitle || null;
            } else {
                response.premiumtitle = premium.title || null;
            }
            response.premiumid = premium ? req.body.platform === "android" ? premium.androidId : premium.iosId : null;
        }
        res.status(200).json(response);
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};