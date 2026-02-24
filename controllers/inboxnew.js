const INBOX = require('../models2/inboxnew');
const USER = require('../models2/usernew');
const CONTENT = require('../models/content');
const { getName } = require('country-list');
const OneSignal = require('onesignal-node');
const axios = require('axios');

// Initialize the OneSignal Client
const client = new OneSignal.Client(
    '69c53fa2-c84d-42a9-b377-1e4fff31fa18',
    'OTMxMGNiMmItYzgzZi00ODU0LTgyNjUtZmYwY2M1NWFmNGZk'
);

async function sendNotification(playerId, data = {}, iconUrl = '') {
    const notification = {
        include_player_ids: [playerId],
        data: {
            type: 'inbox',
            ...data,
        },
        headings: {
            en: "You have a new message.",
            hi: "आपको एक नया संदेश मिला है।",
            es: "Tienes un nuevo mensaje."
        },
        contents: {
            en: "Tap to open!",
            hi: "खोलने के लिए टैप करें!",
            es: "Toca para abrir!"
        },
        small_icon: "ic_stat_onesignal_default", // Android ke liye safe
        large_icon: iconUrl || undefined
    };

    try {
        if (!playerId) {
            throw new Error('Invalid player ID');
        }

        const response = await client.createNotification(notification);

        console.log("✅ Notification Sent Successfully:", response.body);
        return {
            success: true,
            response: response.body
        };
    } catch (error) {
        console.error("❌ Error Sending Notification:", error);
        return {
            success: false,
            error: error.message || error
        };
    }
}


const defaultHintImages = [
    "https://lol-image-bucket.s3.ap-south-1.amazonaws.com/hintimage1.png",
    "https://lol-image-bucket.s3.ap-south-1.amazonaws.com/hintimage2.png",
    // "https://lol-image-bucket.s3.ap-south-1.amazonaws.com/hintimage3.png",
    "https://lol-image-bucket.s3.ap-south-1.amazonaws.com/hintimage4.png",
];


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
        // =================== Handle hint ===================
        req.body.hint = req.body.hint && req.body.hint !== "undefined" && req.body.hint !== "null" ? req.body.hint : "-";

        if (req.uploadedImageUrl) {
            req.body.hintImage = req.uploadedImageUrl;
        } else if (req.body.uploadedImage && req.body.uploadedImage.trim() !== '') {
            req.body.hintImage = req.body.uploadedImage;
        } else {
            req.body.hintImage =
                defaultHintImages[Math.floor(Math.random() * defaultHintImages.length)];
        }

        // =================== Handle language content ===================
        const { lanText } = req.body;
        const contentList = await CONTENT.find();
        const randomItem = contentList[Math.floor(Math.random() * contentList.length)];
        let finalContent = randomItem.Content || "-";

        if (lanText === "hi") finalContent = randomItem.hiContent || finalContent;
        else if (lanText === "es") finalContent = randomItem.esContent || finalContent;
        else if (lanText === "fr") finalContent = randomItem.frContent || finalContent;
        else if (lanText === "ur") finalContent = randomItem.urContent || finalContent;

        req.body.hintContent = finalContent;

        // =================== Handle location ===================
        const fetch = (await import('node-fetch')).default;

        const getClientIp = (req) => {
            const xForwardedFor = req.headers['x-forwarded-for'];
            if (xForwardedFor) return xForwardedFor.split(',')[0].trim();
            return req.connection.remoteAddress || req.socket.remoteAddress || req.connection.socket?.remoteAddress;
        };

        const ip = getClientIp(req);

        if (ip && req.body.userLocation === "allow") {
            try {
                const url = `http://ip-api.com/json/${ip}?fields=status,country,regionName,city,query`;
                const response = await fetch(url);
                const data = await response.json();
                if (data.status === "success") {
                    let city = data.city || "-";
                    let region = data.regionName || "-";
                    let country = data.country || "-";

                    // Translate location if language is not English
                    if (lanText && lanText !== "en") {
                        city = await translateText(city, "en", lanText);
                        region = await translateText(region, "en", lanText);
                        country = await translateText(country, "en", lanText);
                    }

                    req.body.location = `${city} ${region}`;
                    req.body.country = country;
                } else {
                    req.body.location = "-";
                    req.body.country = "-";
                }
            } catch (error) {
                console.error("Error fetching location:", error);
                req.body.location = "-";
                req.body.country = "-";
            }
        } else {
            req.body.location = '-';
            req.body.country = '-';
        }

        req.body.ip = req.body.deviceIp;

        // =================== Handle user & block list ===================
        const User = await USER.findOne({ id: req.body.id });
        if (!User) throw new Error('User Not Found');
        if (User.blockList && User.blockList.includes(req.body.ip)) {
            throw new Error('You Are Blocked For This Link');
        }

        // =================== Handle time ===================
        let time = new Date().toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: 'numeric',
            hour12: true,
            timeZone: 'Asia/Kolkata'
        });

        // Translate time if language is not English
        if (lanText && lanText !== "en") {
            time = await translateText(time, "en", lanText);
        }
        req.body.time = time;

        if (!req.body.confessionVoice) {
            req.body.confessionVoice = req.ques5audioUrl
        }

        if (!req.body.roastVoice) {
            req.body.roastVoice = req.ques8audioUrl
        }

        // =================== Handle answer object ===================
        req.body.answer = {
            ...req.body.answer,
            ...(req.body.word && { word: req.body.word }),
            ...(req.contentFileUrl && { contentFile: req.contentFileUrl }),
            ...(req.body.image && { image: req.body.image }),
            ...(req.body.comment && { comment: req.body.comment }),
            ...(req.body.quetype && { quetype: req.body.quetype }),
            ...(req.body.annoyimage && { annoyimage: req.body.annoyimage }),
            ...(req.body.nickname && { nickname: req.body.nickname }),
            ...(req.body.annoycardtitle && { annoycardtitle: JSON.parse(req.body.annoycardtitle) }),
            ...(req.body.annoyans && { annoyans: JSON.parse(req.body.annoyans) }),
            ...(req.body.cardBg && { cardBg: req.body.cardBg }),
            ...(req.body.shapeUrl && { shapeUrl: req.body.shapeUrl }),
            ...(req.body.fontname && { fontname: req.body.fontname }),
            ...(req.body.shapename && { shapename: req.body.shapename }),
            ...(req.body.emotionBg && { emotionBg: req.body.emotionBg }),
            ...(req.body.emotionEmoji && { emotionEmoji: req.body.emotionEmoji }),
            ...(req.body.emotionContent && { emotionContent: req.body.emotionContent }),
            ...(req.body.emotionTitle && { emotionTitle: req.body.emotionTitle }),
            ...(req.emotionVoiceUrl && { emotionVoice: req.emotionVoiceUrl }),
            ...(req.body.confessionType && { confessionType: req.body.confessionType }),
            ...(req.body.confessionTitle && { confessionTitle: req.body.confessionTitle }),
            ...(req.body.confessionContent && { confessionContent: req.body.confessionContent }),
            ...(req.body.confessionEmoji && { confessionEmoji: req.body.confessionEmoji }),
            ...(req.body.confessionVoice && { confessionVoice: req.body.confessionVoice }),
            ...(req.body.hotnessBg && { hotnessBg: req.body.hotnessBg }),
            ...(req.body.hotnessName && { hotnessName: req.body.hotnessName }),
            ...(req.body.hotnessEmoji && { hotnessEmoji: req.body.hotnessEmoji }),
            ...(req.body.hotnessHand && { hotnessHand: req.body.hotnessHand }),
            ...(req.body.hotnessComment && { hotnessComment: req.body.hotnessComment }),
            ...(req.body.friendBg && { friendBg: req.body.friendBg }),
            ...(req.body.friendName && { friendName: req.body.friendName }),
            ...(req.body.friendEmoji && { friendEmoji: req.body.friendEmoji }),
            ...(req.body.friendContent && { friendContent: req.body.friendContent }),
            ...(req.body.roastType && { roastType: req.body.roastType }),
            ...(req.body.roastContent && { roastContent: req.body.roastContent }),
            ...(req.body.roastEmoji && { roastEmoji: req.body.roastEmoji }),
            ...(req.body.roastVoice && { roastVoice: req.body.roastVoice }),
            ...(req.body.bluffBg && { bluffBg: req.body.bluffBg }),
            ...(req.body.bluffContent && { bluffContent: req.body.bluffContent }),
            ...(req.body.bluffEmoji && { bluffEmoji: req.body.bluffEmoji }),
            ...(req.body.challengeContent && { challengeContent: req.body.challengeContent }),
        };

        // =================== Create INBOX ===================
        const dataCreate = await INBOX.create(req.body);
        const filteredData = dataCreate.toObject();
        delete filteredData.__v;
        delete filteredData._id;

        res.status(201).json({
            status: 1,
            message: 'Card Created Successfully',
            data: filteredData
        });

        // =================== Notifications (async) ===================
        const playerIds = User.deviceToken || [];
        const iconUrl = 'https://lol-image-bucket.s3.ap-south-1.amazonaws.com/logo.png';
        (async () => {
            for (const token of playerIds) {
                if (token && token.trim() !== '') {
                    try {
                        await sendNotification(token, { customKey: 'customValue' }, iconUrl);
                    } catch (notifyErr) {
                        console.error("Notification failed for token:", token, notifyErr);
                    }
                }
            }
        })();

    } catch (error) {
        console.error('Full error object:', error);
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};



exports.Read = async function (req, res, next) {
    try {
        const { id } = req.body;
        const dataRead = await INBOX.find({ id: id })
            .select('-__v -id')
            .sort({ createdAt: -1 });

        if (!dataRead || dataRead.length === 0) {
            return res.status(200).json({
                status: 2,
                message: 'No Inbox Found'
            });
        }

        // Customize the response
        const customizedData = dataRead.map(item => {
            let answerData = {};

            if (item.category === 'V2hvVGFsa2lu') {
                answerData = {
                    word: item.answer?.word,
                    contentFile: item.answer?.contentFile
                };
            } else if (item.category === 'UGljIFJvYXN0') {
                answerData = {
                    image: item.answer?.image,
                    comment: item.answer?.comment,
                    quetype: item.answer?.quetype
                };
            } else if (item.category === 'QW5ub3kgZnVuIENhcmQ=') {
                answerData = {
                    annoyimage: item.answer?.annoyimage,
                    shapename: item.answer?.shapename,
                    nickname: item.answer?.nickname,
                    shapeUrl: item.answer?.shapeUrl,
                    fontname: item.answer?.fontname,
                    annoycardtitle: item.answer?.annoycardtitle,
                    annoyans: item.answer?.annoyans,
                    cardBg: item.answer?.cardBg,
                };
            } else {
                answerData = {
                    word: item.answer?.word,
                    contentFile: item.answer?.contentFile
                };
            }

            return {
                _id: item._id,
                category: item.category,
                question: item.question,
                hint: item.hint,
                hintImage: item.hintImage && item.hintImage.trim() !== ''
                    ? item.hintImage
                    : defaultHintImages[Math.floor(Math.random() * defaultHintImages.length)],
                location: item.location,
                country: item.country,
                ip: item.ip,
                time: item.time,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt,
                answer: answerData
            };
        });

        res.status(200).json({
            status: 1,
            message: 'Data Found Successfully',
            data: customizedData,
        });

    } catch (error) {
        res.status(400).json({
            status: 0,
            error: error.message,
        });
    }
};

// ================= inbox pagination add ==================
exports.ReadPagination = async function (req, res, next) {
    try {
        const { id, page = 1, limit = 15 } = req.body;

        const skip = (page - 1) * limit;

        // Count total records
        const total = await INBOX.countDocuments({ id: id });

        const dataRead = await INBOX.find({ id: id })
            .select('-__v -id')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        if (!dataRead || dataRead.length === 0) {
            return res.status(200).json({
                status: 2,
                message: 'No Inbox Found'
            });
        }

        // Customize the response
        const customizedData = dataRead.map(item => {
            let answerData = {};

            if (item.category === 'V2hvVGFsa2lu') {
                answerData = {
                    word: item.answer?.word,
                    contentFile: item.answer?.contentFile
                };
            } else if (item.category === 'UGljIFJvYXN0') {
                answerData = {
                    image: item.answer?.image,
                    comment: item.answer?.comment,
                    quetype: item.answer?.quetype
                };
            } else if (item.category === 'QW5ub3kgZnVuIENhcmQ=') {
                answerData = {
                    annoyimage: item.answer?.annoyimage,
                    shapename: item.answer?.shapename,
                    nickname: item.answer?.nickname,
                    shapeUrl: item.answer?.shapeUrl,
                    fontname: item.answer?.fontname,
                    annoycardtitle: item.answer?.annoycardtitle,
                    annoyans: item.answer?.annoyans,
                    cardBg: item.answer?.cardBg,
                };
            } else if (item.category === 'RW1vdGlvbg==') {
                answerData = {
                    emotionBg: item.answer?.emotionBg,
                    emotionEmoji: item.answer?.emotionEmoji,
                    emotionContent: item.answer?.emotionContent,
                    emotionTitle: item.answer?.emotionTitle ?? null,
                    emotionVoice: item.answer?.emotionVoice
                };
            } else if (item.category === 'Q29uZmVzc2lvbg==') {
                answerData = {
                    confessionType: item.answer?.confessionType ?? null,
                    confessionTitle: item.answer?.confessionTitle ?? null,
                    confessionContent: item.answer?.confessionContent ?? null,
                    confessionVoice: item.answer?.confessionVoice ?? null,
                    confessionEmoji: item.answer?.confessionEmoji ?? null
                };

            } else if (item.category === 'UXVlc3Rpb24=') {
                answerData = {
                    confessionType: item.answer?.confessionType ?? null,
                    confessionTitle: item.answer?.confessionTitle ?? null,
                    confessionContent: item.answer?.confessionContent ?? null,
                    confessionVoice: item.answer?.confessionVoice ?? null,
                    confessionEmoji: item.answer?.confessionEmoji ?? null
                };

            } else if (item.category === 'SG90bmVzcw==') {
                answerData = {
                    hotnessBg: item.answer?.hotnessBg ?? null,
                    hotnessName: item.answer?.hotnessName ?? null,
                    hotnessEmoji: item.answer?.hotnessEmoji ?? null,
                    hotnessHand: item.answer?.hotnessHand ?? 'https://lol-image-bucket.s3.ap-south-1.amazonaws.com/images/question6/whitecard.png',
                    hotnessComment: item.answer?.hotnessComment ?? null
                };
            } else if (item.category === 'RnJpZW5k' || item.category === 'Q3J1c2g=' || item.category === 'TG92ZQ==') {
                answerData = {
                    friendBg: item.answer?.friendBg ?? null,
                    friendName: item.answer?.friendName ?? null,
                    friendEmoji: item.answer?.friendEmoji ?? null,
                    friendContent: item.answer?.friendContent ?? null
                };
            } else if (item.category === 'Um9hc3Q=') {
                answerData = {
                    roastType: item.answer?.roastType ?? null,
                    roastContent: item.answer?.roastContent ?? null,
                    roastVoice: item.answer?.roastVoice ?? null,
                    roastEmoji: item.answer?.roastEmoji ?? null
                };

            } else if (item.category === 'Qmx1ZmY=') {
                answerData = {
                    bluffBg: item.answer?.bluffBg ?? null,
                    bluffContent: item.answer?.bluffContent ?? null,
                    bluffEmoji: item.answer?.bluffEmoji ?? null,
                };

            } else if (item.category === 'Q2hhbGxlbmdl') {
                answerData = {
                    challengeContent: item.answer?.challengeContent ?? null,
                };

            } else {
                answerData = {
                    word: item.answer?.word,
                    contentFile: item.answer?.contentFile
                };
            }

            return {
                _id: item._id,
                category: item.category,
                question: item.question,
                hint: item.hint,
                hintImage: item.hintImage && item.hintImage.trim() !== ''
                    ? item.hintImage
                    : defaultHintImages[Math.floor(Math.random() * defaultHintImages.length)],
                hintContent: item.hintContent,
                location: item.location,
                country: item.country,
                ip: item.ip,
                time: item.time,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt,
                answer: answerData
            };
        });

        res.status(200).json({
            status: 1,
            message: 'Data Found Successfully',
            data: customizedData,
        });

    } catch (error) {
        res.status(400).json({
            status: 0,
            error: error.message,
        });
    }
};

exports.Delete = async function (req, res, next) {
    try {

        const { inboxId } = req.body;

        if (!inboxId) {
            throw new Error("inbox value is required");

        }

        const inbox = await INBOX.findByIdAndDelete(inboxId);

        if (!inbox) {
            throw new Error("inbox not found");
        }

        res.status(200).json({
            status: 1,
            message: 'Card Delete Successfully',
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};

// ================================================= voice masking ============================================================

exports.VoiceMasking = async function (req, res, next) {
    try {
        res.status(201).json({
            status: 1,
            message: req.voiceConverted 
                ? 'Voice converted successfully' 
                : 'Voice uploaded successfully (conversion unavailable)',
            data: req.confessionVoiceUrl,
            audioStatus: req.audioStatus
        });
    } catch (error) {
        console.error('Full error object:', error);
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};