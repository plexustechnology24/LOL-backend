const NUSER = require('../models2/usernew');
const NINBOX = require('../models2/inboxnew');
const WEB = require('../models/web');
const PREMIUM = require('../models/premium');
const CARDBG = require('../models/cardBg');
const DEVICE = require('../models/device');
const TEMP = require('../models/temp');
const ECARDBG = require('../models/emotionCardBg');
const HCARDBG = require('../models/hotnessCardBg');
const HHCARDBG = require('../models/heavenHellCardBg');
const FCARDBG = require('../models/friendCardBg');
const BCARDBG = require('../models/bluffCardBg');
const HOTNESSCATEGORY = require('../models/hotnessCategory');
const EMOJI = require('../models/emotionEmoji');
const CONTENT = require('../models/emotionContent');
const HEAVENHELLQUE = require('../models/heavenHellQue');
const CHALLENGECONTENT = require('../models/challengeContent');
const USERANALYTICS = require('../models2/userAnalytics');
const COLLAB = require('../models/collab');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const { v4: uuidv4 } = require("uuid");
const crypto = require('crypto');
const SECRET_KEY = 'LOL-KEY';

const { google } = require("googleapis");
const axios = require("axios");
const cheerio = require("cheerio");

const { updateShareAndBadge } = require('../helpers/analyticsHelper');


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
        console.log(data);

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

async function fetchAppleSubscription(originalTransactionId) {
    const token = generateAppleJWT();
    console.log(token);


    const urls = [
        `https://api.storekit.itunes.apple.com/inApps/v1/subscriptions/${originalTransactionId}`,
        `https://api.storekit-sandbox.itunes.apple.com/inApps/v1/subscriptions/${originalTransactionId}`
    ];

    for (const url of urls) {
        try {
            const { data } = await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return data.data?.[0]?.lastTransactions?.[0];
        } catch (err) {
            if (![401, 404].includes(err.response?.status)) throw err;
        }
    }
    return null;
}

async function verifyApplePurchase(originalTransactionId, id) {
    const transaction = await fetchAppleSubscription(originalTransactionId);
    if (!transaction) return null;
    console.log(transaction);

    const status = transaction.status;
    const decoded = jwt.decode(transaction.signedTransactionInfo);
    const decodedRenewal = jwt.decode(transaction.signedRenewalInfo);

    let productId = null;

    if (decodedRenewal) {
        if (decodedRenewal.autoRenewStatus === 1) {
            productId = decodedRenewal.autoRenewProductId;
        } else {
            productId = decodedRenewal.productId;
        }
    }

    if (decoded && id) {
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

    return { status, productId }; // ✅ RETURN BOTH
}

async function checkGracePeriod(originalTransactionId) {
    const transaction = await fetchAppleSubscription(originalTransactionId);
    if (!transaction) return "false";

    const decoded = jwt.decode(transaction.signedRenewalInfo);
    const graceExpire = Number(decoded?.gracePeriodExpiresDate || 0);

    return graceExpire > Date.now() ? "true" : "false";
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
const allPremiumQuestions = [
    "QW5ub3kgZnVuIENhcmQ=",
    "RW1vdGlvbg==",
    "Q29uZmVzc2lvbg==",
    "SG90bmVzcw==",
    "RnJpZW5k",
    "Um9hc3Q=",
    "Qmx1ZmY=",
    "Q2hhbGxlbmdl",
    "SGVhdmVuSGVsbA==",
];
function getRandomQuestions(array, count = 3) {
    const shuffled = array.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}
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

        req.body.premiumQuestion = getRandomQuestions(allPremiumQuestions, 3);
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
            const { _id, createdAt, updatedAt, __v, picroastcredit, deviceToken, deviceId, latitude, longitude, ...otherData } = userData.toObject();


            let response = {
                UserIdStatus: false,
                message: 'Authentication Id Exists',
                token: token
            };

            if (req.body.platform) {
                const premium = await PREMIUM.findOne({ isActive: true })
                const langMap = {
                    hi: "hiTitle",
                    es: "esTitle",
                    ta: "taTitle",
                    mr: "mrTitle",
                    enhi: "enhiTitle"
                };

                const key = langMap[req.body.lan] || "title";
                response.premiumtitle = premium[key] || null;
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
                const langMap = {
                    hi: "hiTitle",
                    es: "esTitle",
                    ta: "taTitle",
                    mr: "mrTitle",
                    enhi: "enhiTitle"
                };

                const key = langMap[req.body.lan] || "title";
                response.premiumtitle = premium[key] || null;
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

exports.ProfileUpdateNew = async function (req, res, next) {
    try {
        if (req.file) {
            req.body.avatar = req.file.s3Url;
        } else if (req.body.avatarUrl) {
            req.body.avatar = req.body.avatarUrl;
        }

        const { id } = req.body;

        // ================== BADGE CALCULATION ==================
        const analytics = await USERANALYTICS.findOne({ id: id });

        let totalShare = 0;

        if (analytics && analytics.questions.length > 0) {
            totalShare = analytics.questions.reduce((sum, q) => {
                return sum + (q.share || 0) + (q.reply || 0);
            }, 0);
        }

        // Badge logic
        function getBadge(totalShare) {
            if (totalShare >= 200) {
                return {
                    name: "Famous",
                    image: "https://lol-image-bucket.s3.ap-south-1.amazonaws.com/famous.png"
                };
            }

            if (totalShare >= 100) {
                return {
                    name: "Trending",
                    image: "https://lol-image-bucket.s3.ap-south-1.amazonaws.com/trending.png"
                };
            }

            if (totalShare >= 40) {
                return {
                    name: "Popular",
                    image: "https://lol-image-bucket.s3.ap-south-1.amazonaws.com/popular.png"
                };
            }

            if (totalShare >= 10) {
                return {
                    name: "Active",
                    image: "https://lol-image-bucket.s3.ap-south-1.amazonaws.com/active.png"
                };
            }

            return {
                name: "New",
                image: "https://lol-image-bucket.s3.ap-south-1.amazonaws.com/new.png"
            };
        }

        const badgeData = getBadge(totalShare);

        req.body.badge = badgeData.name;
        req.body.badgeImage = badgeData.image;

        // ================== PROFILE UPDATE ==================

        const dataUpdate = await NUSER.findOneAndUpdate(
            { id: id },
            req.body,
            { new: true }
        );

        if (!dataUpdate) {
            throw new Error("id not found");
        }

        const data = dataUpdate.toObject();

        const filteredData = {
            username: data.username,
            avatar: data.avatar,
            birthdate: data.birthdate
        };

        res.status(200).json({
            status: 1,
            message: "Profile Updated successfully",
            data: filteredData
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

exports.AutoMessage = async function (req, res, next) {
    try {

        const { id, autoMessage } = req.body;

        if (!id || !autoMessage) {
            throw new Error("id and autoMessage are required");
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
        let subscriptionId = null;

        // ================= ANDROID =================
        if (req.body.platform === "android") {

            const packageName = "com.lol.android";
            const purchaseToken = req.body.purchasedata;

            let linkedToken = null;

            if (purchaseToken) {
                const verifyResult = await verifyGooglePurchase(
                    packageName,
                    req.body.subscriptionId,
                    purchaseToken
                );

                linkedToken = verifyResult.linkedPurchaseToken;

                const lineItem = verifyResult.lineItems?.[0];

                if (lineItem?.expiryTime) {
                    const expiryDate = new Date(lineItem.expiryTime);
                    purchasestatus = expiryDate > new Date() ? "true" : "false";
                }

                purchaseId = purchaseToken;
                subscriptionId = lineItem?.offerDetails?.basePlanId || null;
            }

            if (linkedToken) {
                await NUSER.updateMany(
                    { purchaseId: linkedToken },
                    { isPurchase: purchasestatus, purchaseId, subscriptionId }
                );
            }

            await NUSER.findOneAndUpdate(
                { id: req.body.id },
                { isPurchase: purchasestatus, purchaseId, subscriptionId },
                { new: true }
            );
        }

        // ================= IOS =================
        if (req.body.platform === "ios") {

            const receiptData = req.body.purchasedata;

            if (receiptData) {
                const result = await verifyApplePurchase(receiptData, req.body.id);

                const status = result?.status;
                subscriptionId = result?.productId;

                purchasestatus = [1, 3].includes(status) ? "true" : "false";
                purchaseId = receiptData;

                await NUSER.findOneAndUpdate(
                    { id: req.body.id },
                    {
                        isPurchase: purchasestatus,
                        purchaseId,
                        subscriptionId
                    },
                    { new: true }
                );
            }

            if (purchasestatus === "false") {
                await NUSER.updateMany(
                    { purchaseId: req.body.purchasedata },
                    {
                        $set: {
                            purchaseId: null,
                            isPurchase: false,
                            subscriptionId: null
                        }
                    }
                );
            }
        }

        // ================= RESPONSE =================
        res.status(200).json({
            status: 1,
            message: 'User-Purchase Update Successfully',
            purchasestatus: purchasestatus,
            purchaseId: purchaseId,
            subscriptionId: subscriptionId
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
        const { id, categoryname, question, lan, timestamp, quetype } = req.body;

        if (!categoryname || !question || !lan) {
            throw new Error('categoryname, lan & question value is required');
        }

        const user = await NUSER.findOne({ id: id });
        if (!user) {
            throw new Error('User not found');
        }
        // =================== share count update

        await updateShareAndBadge(id, categoryname, user);

        // ===========================================

        let updated = false;

        if (categoryname === 'UGljIFJvYXN0') {
            if (!timestamp || !quetype) {
                throw new Error(' quetype & timestamp value is required');
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

exports.PicRoastData = async function (req, res, next) {
    try {
        const { id } = req.body;

        const user = await NUSER.findOne({ id: id });

        if (!user) {
            throw new Error('User not found');
        }

        const CATEGORY_KEY = "UGljIFJvYXN0";

        // filter + map
        const data = (user.question || [])
            .filter(q => q.category === CATEGORY_KEY && q.answer?.image && q.answer?.quetype)
            .map(q => ({
                image: q.answer.image,
                quetype: q.answer.quetype
            }));

        res.status(200).json({
            status: 1,
            message: 'Data Found Successfully',
            data: data
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
        "Weird talent",
        "Hobby",
        "Favourite memory",
        "Secret",
        "Hidden talent",
        "Embarrassing moment",
        "First impression",
        "Mood",
        "Guilty pleasure",
        "Crush",
        "Weird habit",
        "Random fact",
        "Secret wish",
        "Night thoughts",
        "Funny dream"
    ],
    es: [
        "Talento raro",
        "Pasatiempo",
        "Recuerdo favorito",
        "Secreto",
        "Talento oculto",
        "Momento vergonzoso",
        "Primera impresión",
        "Estado de ánimo",
        "Placer culposo",
        "Crush",
        "Hábito raro",
        "Dato aleatorio",
        "Deseo secreto",
        "Pensamientos nocturnos",
        "Sueño divertido"
    ],
    hi: [
        "अजीब टैलेंट",
        "शौक",
        "पसंदीदा याद",
        "राज़",
        "छुपा हुआ टैलेंट",
        "शर्मनाक पल",
        "पहला इंप्रेशन",
        "मूड",
        "गिल्टी प्लेजर",
        "क्रश",
        "अजीब आदत",
        "रैंडम फैक्ट",
        "सीक्रेट विश",
        "रात के ख्याल",
        "मजेदार सपना"
    ],
    ta: [
        "விசித்திர திறமை",
        "விருப்பம்",
        "பிடித்த நினைவு",
        "ரகசியம்",
        "மறைந்த திறமை",
        "வெட்கப்படத்தக்க தருணம்",
        "முதல் பார்வை",
        "மனநிலை",
        "குற்ற உணர்ச்சி மகிழ்ச்சி",
        "க்ரஷ்",
        "விசித்திர பழக்கம்",
        "சீரற்ற தகவல்",
        "ரகசிய ஆசை",
        "இரவு எண்ணங்கள்",
        "வேடிக்கையான கனவு"
    ],
    mr: [
        "विचित्र टॅलेंट",
        "छंद",
        "आवडती आठवण",
        "गुपित",
        "लपलेला टॅलेंट",
        "लाजिरवाणा क्षण",
        "पहिली छाप",
        "मूड",
        "गिल्टी प्लेझर",
        "क्रश",
        "विचित्र सवय",
        "रँडम तथ्य",
        "गुपित इच्छा",
        "रात्रीचे विचार",
        "मजेदार स्वप्न"
    ],
    enhi: [
        "Ajeeb Talent",
        "Shauk",
        "Favourite Yaad",
        "Raaz",
        "Hidden Talent",
        "Embarrassing Moment",
        "First Impression",
        "Mood",
        "Guilty Pleasure",
        "Crush",
        "Weird Habit",
        "Random Fact",
        "Secret Wish",
        "Night Thoughts",
        "Funny Dream"
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
        if (categoryname !== "QW5ub3kgZnVuIENhcmQ=") {
            throw new Error('Invalid categoryname');
        }

        const user = await NUSER.findOne({ id: id });
        if (!user) {
            throw new Error('User not found');
        }
        // =================== share count update

        await updateShareAndBadge(id, categoryname, user);

        // ===========================================

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

        const user = await NUSER.findOne({ id });
        if (!user) throw new Error('User not found');

        const lang = (lan && annoyQuestions[lan]) ? lan : 'en';

        const selectedQuestions = [
            ...annoyQuestions[lang],
            ...(user.annoyallcardtitle ? [...user.annoyallcardtitle] : []),
        ];

        let selectedindex = [];

        if (!user.isPurchase) {
            selectedindex = getRandomIndexes(selectedQuestions.length, 4);
        } else {
            const fixed = user.question.filter(
                q => q.category === 'QW5ub3kgZnVuIENhcmQ='
            );

            fixed.forEach(item => {
                if (item.answer?.annoycardtitle?.length) {
                    selectedindex.push(...item.answer.annoycardtitle);
                }
            });

            // ✅ remove duplicates
            selectedindex = [...new Set(selectedindex)];

            console.log(selectedindex);


            const lastIndex = selectedQuestions.length - 1;

            // ✅ CASE 1: user HAS saved indexes
            if (selectedindex.length) {
                const lastThree = selectedindex.slice(-3);
                selectedindex = [lastIndex, ...lastThree];
            }

            // ✅ CASE 2: user has NO saved indexes
            else {
                const randomIndexes = getRandomIndexes(
                    selectedQuestions.length,
                    3,
                    [lastIndex] // exclude last index
                );

                selectedindex = [lastIndex, ...randomIndexes];
            }
        }

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
        user.annoyallcardtitle.push(...cardtitleToAdd);
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

        if (categoryname !== "RW1vdGlvbg==") {
            throw new Error('Invalid categoryname');
        }

        const user = await NUSER.findOne({ id: id });
        if (!user) {
            throw new Error('User not found');
        }
        // =================== share count update

        await updateShareAndBadge(id, categoryname, user);

        // ===========================================
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

        if (categoryname !== "UXVlc3Rpb24=" && categoryname !== "Q29uZmVzc2lvbg==") {
            throw new Error('Invalid categoryname');
        }

        const user = await NUSER.findOne({ id: id });
        if (!user) {
            throw new Error('User not found');
        }
        // =================== share count update

        await updateShareAndBadge(id, categoryname, user);

        // ===========================================

        let updated = false;

        // Ensure user.question is an array
        if (!Array.isArray(user.question)) {
            user.question = [];
        }
        // Build answer object
        const isQuestion = categoryname === "UXVlc3Rpb24=";

        const titleMap = {
            hi: { q: "प्रश्न", c: "कन्फेशन" },
            es: { q: "Pregunta", c: "Confesión" },
            ta: { q: "கேள்வி", c: "ஒப்புதல்" },
            mr: { q: "प्रश्न", c: "कबुली" },
            enhi: { q: "Sawal", c: "Confession" },
            en: { q: "Question", c: "Confession" }
        };

        let answerObj = {
            confessionTitle: (titleMap[lan] || titleMap.en)[isQuestion ? "q" : "c"]
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

            const langMap = {
                hi: { cat: "hicategoryTitle", sub: "hisubCatergoryTitle" },
                es: { cat: "escategoryTitle", sub: "essubCatergoryTitle" },
                ta: { cat: "tacategoryTitle", sub: "tasubCatergoryTitle" },
                mr: { cat: "mrcategoryTitle", sub: "mrsubCatergoryTitle" },
                enhi: { cat: "enhicategoryTitle", sub: "enhisubCatergoryTitle" }
            };

            const selected = langMap[lan] || {};

            categoryTitle = item[selected.cat] || item.categoryTitle;
            subCategoryTitle = item[selected.sub] || item.subCatergoryTitle;

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

        if (categoryname !== "SG90bmVzcw==") {
            throw new Error('Invalid categoryname');
        }

        const user = await NUSER.findOne({ id: id });
        if (!user) {
            throw new Error('User not found');
        }
        // =================== share count update

        await updateShareAndBadge(id, categoryname, user);

        // ===========================================

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

        if (categoryname !== "TG92ZQ==" && categoryname !== "RnJpZW5k" && categoryname !== "Q3J1c2g=") {
            throw new Error('Invalid categoryname');
        }

        const user = await NUSER.findOne({ id: id });
        if (!user) {
            throw new Error('User not found');
        }
        // =================== share count update

        await updateShareAndBadge(id, categoryname, user);

        // ===========================================

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

        if (categoryname !== "Um9hc3Q=") {
            throw new Error('Invalid categoryname');
        }

        const user = await NUSER.findOne({ id: id });
        if (!user) {
            throw new Error('User not found');
        }
        // =================== share count update

        await updateShareAndBadge(id, categoryname, user);

        // ===========================================

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

        if (categoryname !== "Qmx1ZmY=") {
            throw new Error('Invalid categoryname');
        }

        const user = await NUSER.findOne({ id: id });
        if (!user) {
            throw new Error('User not found');
        }
        // =================== share count update

        await updateShareAndBadge(id, categoryname, user);

        // ===========================================

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

        if (categoryname !== "Q2hhbGxlbmdl") {
            throw new Error('Invalid categoryname');
        }

        const user = await NUSER.findOne({ id: id });
        if (!user) {
            throw new Error('User not found');
        }
        // =================== share count update

        await updateShareAndBadge(id, categoryname, user);

        // ===========================================

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

// =============================== 11 question ===============================
exports.HeavenHell = async function (req, res, next) {
    try {
        const { id, categoryname, question, lan, que1, que2, que3, que4, que5, avatarImg } = req.body;

        if (!categoryname || !question || !lan || !que1 || !que2 || !que3 || !que4 || !que5 || !avatarImg) {
            throw new Error('categoryname, lan , que1 , que2 , que3 , que4 , que5 & avatarImg value is required');
        }

        if (categoryname !== "SGVhdmVuSGVsbA==") {
            throw new Error('Invalid categoryname');
        }

        const user = await NUSER.findOne({ id: id });
        if (!user) {
            throw new Error('User not found');
        }
        // =================== share count update

        await updateShareAndBadge(id, categoryname, user);

        // ===========================================

        let updated = false;

        // Ensure user.question is an array
        if (!Array.isArray(user.question)) {
            user.question = [];
        }

        let answerObj = {
            heavenhellque: [que1, que2, que3, que4, que5],
            avatarImg: avatarImg
        };

        console.log(answerObj);


        user.question = user.question.map(q => {
            if (q.category === "SGVhdmVuSGVsbA==") {
                updated = true;
                return {
                    category: "SGVhdmVuSGVsbA==",
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
                category: "SGVhdmVuSGVsbA==",
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

exports.HeavenHellQues = async function (req, res, next) {
    try {
        const { id, lan, type } = req.body;

        if (!lan || !type) {
            throw new Error('lan , type  value is required');
        }

        const user = await NUSER.findOne({ id: id });
        if (!user) throw new Error('User not found');

        const ques = await HEAVENHELLQUE.find();

        const adminQues = ques.map(q =>
            lan === 'hi' ? q.hiContent :
                lan === 'es' ? q.esContent :
                    q.Content
        );

        const getRandom = (arr, count) => {
            const shuffled = [...arr].sort(() => 0.5 - Math.random());
            return shuffled.slice(0, count);
        };

        let finalIds = [];

        if (!user.isPurchase) {
            finalIds = getRandom(adminQues, 5);
        } else {
            if (Number(type) === 2) {
                finalIds = getRandom(adminQues, 1);
            } else {
                let userIds = user.question
                    .filter(q => q.category === "SGVhdmVuSGVsbA==")
                    .map(q => q.answer.heavenhellque)
                    .flat();

                userIds = userIds.map(id => id.toString());
                const userNotInAdmin = userIds.filter(
                    uid => !adminQues.includes(uid)
                );

                const fixed = userNotInAdmin.slice(0, 5);

                const remainingCount = 5 - fixed.length;

                if (remainingCount > 0) {
                    const randomAdmin = getRandom(adminQues, remainingCount);
                    finalIds = [...fixed, ...randomAdmin];
                } else {
                    finalIds = fixed;
                }
            }
        }

        res.status(200).json({
            status: 1,
            message: 'Ques find successfully',
            data: finalIds
        });

    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};
// =============================== user view get ====================================
exports.UserViews = async function (req, res, next) {
    try {
        const { id } = req.body;

        const user = await USERANALYTICS.findOne({ id: id });
        if (!user) {
            throw new Error('user data not found');
        }

        const questions = user.questions.map(q => ({
            category: q.category,
            view: q.view,
        }));

        res.status(200).json({
            status: 1,
            message: 'Views found Successfully',
            data: questions
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};
// =============================== language update ====================================
exports.UserLanguage = async function (req, res, next) {
    try {
        const { id, lan } = req.body;

        if (!lan) {
            throw new Error("Language (lan) is required");
        }

        const user = await NUSER.findOneAndUpdate(
            { id: id },
            { $set: { language: lan } },
            { new: true }
        );

        if (!user) {
            throw new Error('user data not found');
        }


        res.status(200).json({
            status: 1,
            message: 'Language updated Successfully',
            data: user.language
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

            console.log(mergedArray, "merge");


            // Step 3: Get indices and find values
            const indices = matched.answer?.annoycardtitle || [];
            const annoycardvalue = indices.map(index => mergedArray[index]).filter(Boolean);
            console.log(indices, "index");
            console.log(annoycardvalue, "annoycardvalue");


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

        const contentMap = {
            hi: "hiContent",
            es: "esContent",
            ta: "taContent",
            mr: "mrContent",
            enhi: "enhiContent"
        };

        const key = contentMap[req.body.lanText] || "Content";
        let Content = Data[0][key];
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

        const contentMap = {
            hi: "hiContent",
            es: "esContent",
            ta: "taContent",
            mr: "mrContent",
            enhi: "enhiContent"
        };

        const key = contentMap[req.body.lanText] || "Content";
        let Content = Data[0][key];

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


exports.WebHeavenHellCardPreview = async (req, res, next) => {
    try {
        const { category } = req.body;
        const CardBg = await HHCARDBG.aggregate([
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
            const langMap = {
                hi: "hisubCatergoryTitle",
                es: "essubCatergoryTitle",
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
        let subscriptionId = userData.subscriptionId || null;
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
                const verifyResult = await verifyGooglePurchase(packageName, subscriptionId, purchaseDataToVerify);
                const lineItem = verifyResult.lineItems?.[0];
                switch (verifyResult?.subscriptionState) {
                    case "SUBSCRIPTION_STATE_ACTIVE":
                        purchasestatus = "true";
                        break;

                    case "SUBSCRIPTION_STATE_IN_GRACE_PERIOD":
                        purchasestatus = "true";
                        gracePeriod = "true"
                        break;

                    case "SUBSCRIPTION_STATE_CANCELED":
                        const expiryDate = new Date(lineItem?.expiryTime);
                        purchasestatus = expiryDate > new Date() ? "true" : "false";
                        break;

                    default:
                        purchasestatus = "false";
                }
            }
            if (req.body.platform === "ios" && purchaseDataToVerify) {

                const result = await verifyApplePurchase(purchaseDataToVerify, id);
                const status = result?.status;
                subscriptionId = result?.productId;

                if ([1, 4].includes(status)) {
                    purchasestatus = "true";
                    if (status === 4) gracePeriod = "true";
                }
                else if (status === 3) {
                    purchasestatus = await checkGracePeriod(purchaseDataToVerify);
                }
                else {
                    purchasestatus = "false";
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
        // ========================= share and rply count ============================
        const analytics = await USERANALYTICS.findOne({ id: id });

        let totalShare = 0;
        let totalReply = 0;

        if (analytics?.questions?.length > 0) {
            totalShare = analytics.questions.reduce(
                (sum, q) => sum + (q.share || 0), 0
            );

            totalReply = analytics.questions.reduce(
                (sum, q) => sum + (q.reply || 0), 0
            );
        }
        // =====================================

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
            response.subscriptionId = subscriptionId;
            const langMap = {
                hi: "hiTitle",
                es: "esTitle",
                ta: "taTitle",
                mr: "mrTitle",
                enhi: "enhiTitle"
            };

            const key = langMap[req.body.lan] || "title";
            response.premiumtitle = premium[key] || null;
            response.premiumid = premium ? req.body.platform === "android" ? premium.androidId : premium.iosId : null;
            response.language = userData.language;
            response.badge = userData.badge || null;
            response.badgeImage = userData.badgeImage || null;
            response.totalShare = totalShare;
            response.totalReply = totalReply;
            response.username = userData.username || null;
            response.birthdate = userData.birthdate || null;
            response.premiumQuestion = userData.premiumQuestion || null;
        }
        res.status(200).json(response);
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};

