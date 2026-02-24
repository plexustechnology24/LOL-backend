const INBOXADMIN = require('../models/inboxAdmin');
const USER = require('../models2/user');
const OneSignal = require('onesignal-node');

const client = new OneSignal.Client(
    '69c53fa2-c84d-42a9-b377-1e4fff31fa18',
    'OTMxMGNiMmItYzgzZi00ODU0LTgyNjUtZmYwY2M1NWFmNGZk'
);

async function sendNotification(playerId, userLanguage, data = {}, iconUrl = '') {
    const messages = {
        en: {
            title: 'You have a new Jolly card',
            description: 'Tap to open'
        },
        hi: {
            title: 'आपके पास एक नया जॉली कार्ड आया है',
            description: 'कार्ड पर टेप लगाएं'
        },
        es: {
            title: 'Tienes una nueva tarjeta Jolly',
            description: 'Toca para abrir'
        },
        ur: {
            title: 'آپ کے پاس ایک نیا جولی کارڈ ہے۔',
            description: 'کھولنے کے لیے تھپتھپائیں۔'
        },
        fr: {
            title: 'Vous avez une nouvelle carte Jolly',
            description: 'Appuyez pour ouvrir'
        },
        pt: {
            title: 'Você tem um novo cartão Jolly',
            description: 'Toque para abrir'
        },
        in: {
            title: 'Anda memiliki kartu Jolly baru',
            description: 'Ketuk untuk membuka'
        },
        ar: {
            title: 'لديك بطاقة جولي جديدة',
            description: 'انقر لفتح'
        }
    };

    const messageContent = messages[userLanguage] || messages['en'];

    const notification = {
        contents: {
            'en': messageContent.description,
            [userLanguage]: messageContent.description
        },
        headings: {
            'en': messageContent.title,
            [userLanguage]: messageContent.title
        },
        include_player_ids: [playerId],
        data: data,
        small_icon: iconUrl,
        large_icon: iconUrl,
        android_small_icon: iconUrl,
        android_large_icon: iconUrl
    };

    try {
        if (!playerId) {
            throw new Error('Invalid player ID');
        }
        const response = await client.createNotification(notification);
        // console.log('Notification sent:', response.body.id);
        return response.body.id;
    } catch (error) {
        console.error('Error sending notification:', error);
        throw error;
    }
}



// ========================================

async function createInboxEntriesForAllUsers() {
    try {
        const data = await INBOXADMIN.find().select('-__v -username');

        if (data.length === 0) {
            throw new Error('No data found for users');
        }

        const randomIndex = Math.floor(Math.random() * data.length);
        const selectedData = data[randomIndex];

        const users = await USER.find({}).select('username deviceToken language');

        // Only create entries for users who need them
        const createPromises = users.map(async (user) => {
            const newInboxEntry = {
                username: user.username,
                bgUrl: selectedData.bgUrl,
                avatar: selectedData.avatar,
                ip: " ",
                location: " ",
                time: " ",
                country: " ",
                hint: (function () {
                    switch (user.language) {
                        case 'hi': return selectedData.hintHi;
                        case 'es': return selectedData.hintEs;
                        case 'ur': return selectedData.hintUr;
                        case 'fr': return selectedData.hintFr;
                        case 'pt': return selectedData.hintPt;
                        case 'in': return selectedData.hintIn;
                        case 'ar': return selectedData.hintAr;
                        default: return selectedData.hint;
                    }
                })(),
                nickname: (function () {
                    switch (user.language) {
                        case 'hi': return selectedData.nicknameHi;
                        case 'es': return selectedData.nicknameEs;
                        case 'ur': return selectedData.nicknameUr;
                        case 'fr': return selectedData.nicknameFr;
                        case 'pt': return selectedData.nicknamePt;
                        case 'in': return selectedData.nicknameIn;
                        case 'ar': return selectedData.nicknameAr;
                        default: return selectedData.nickname;
                    }
                })(),
                selectedCardTitle: (function () {
                    switch (user.language) {
                        case 'hi': return selectedData.selectedCardTitleHi;
                        case 'es': return selectedData.selectedCardTitleEs;
                        case 'ur': return selectedData.selectedCardTitleUr;
                        case 'fr': return selectedData.selectedCardTitleFr;
                        case 'pt': return selectedData.selectedCardTitlePt;
                        case 'in': return selectedData.selectedCardTitleIn;
                        case 'ar': return selectedData.selectedCardTitleAr;
                        default: return selectedData.selectedCardTitle;
                    }
                })(),
                createdAt: new Date()
            };
            
            // const createdEntry = await INBOX.create(newInboxEntry);

            if (user.deviceToken) {
                const iconUrl = 'https://lol-image-bucket.s3.ap-south-1.amazonaws.com/logo.png';
                await sendNotification(
                    user.deviceToken,
                    user.language || 'en',
                    { customKey: 'customValue' },
                    iconUrl
                );
            }

        });

    } catch (error) {
        console.error('Error during inbox entry creation:', error);
        throw error;
    }
}

createInboxEntriesForAllUsers();
