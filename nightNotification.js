const mongoose = require('mongoose');
const OneSignal = require('onesignal-node');

console.log("🚀 Auto Notification Sender Starting...");

// ─── MongoDB Connections ───────────────────────────────────────────────────────
const mongoUri = "mongodb+srv://loladmin:sPuNLyNN43P9kvJJ@lol.xtafe5q.mongodb.net/LOL";

const connection1 = mongoose.createConnection(mongoUri);
const connection2 = mongoose.createConnection(mongoUri);

connection1.on('connected', () => console.log('✅ connection1 (notifications) connected'));
connection1.on('error',     (err) => console.error('❌ connection1 error:', err));
connection2.on('connected', () => console.log('✅ connection2 (users) connected'));
connection2.on('error',     (err) => console.error('❌ connection2 error:', err));

// ─── Schemas ──────────────────────────────────────────────────────────────────
const autoNotificationSchema = new mongoose.Schema({
    Title:           String,
    hiTitle:         String,
    enhiTitle:       String,
    mrTitle:         String,
    taTitle:         String,
    Description:     String,
    hiDescription:   String,
    enhiDescription: String,
    mrDescription:   String,
    taDescription:   String,
}, { versionKey: false, timestamps: true });

const newuserSchema = new mongoose.Schema({
    id:          { type: String, required: true, unique: true },
    language:    { type: String },
    deviceToken: [String],
    latitude:    { type: String },
    longitude:   { type: String },
}, { timestamps: true });

// ─── Models ───────────────────────────────────────────────────────────────────
const NOTIFICATION = connection1.models['auto-notification']
    || connection1.model('auto-notification', autoNotificationSchema);

const NUSER = connection2.models['newuser']
    || connection2.model('newuser', newuserSchema);

// ─── OneSignal Client ─────────────────────────────────────────────────────────
const client = new OneSignal.Client(
    '69c53fa2-c84d-42a9-b377-1e4fff31fa18',
    'OTMxMGNiMmItYzgzZi00ODU0LTgyNjUtZmYwY2M1NWFmNGZk'
);

// ─── Constants ────────────────────────────────────────────────────────────────
// const SUPPORTED_LANGUAGES = ['en', 'hi', 'enhi', 'mr', 'ta'];
const SUPPORTED_LANGUAGES = ['en', 'hi', 'enhi', 'mr', 'ta'];

const isValidUUID = (id) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const chunkArray = (arr, size = 2000) => {
    const result = [];
    for (let i = 0; i < arr.length; i += size) {
        result.push(arr.slice(i, i + size));
    }
    return result;
};

// ─── Send Bulk via Player IDs ─────────────────────────────────────────────────
async function sendBulkNotification(
    playerIds,
    title,
    message,
    extraData = {},
    iconUrl = 'https://lol-image-bucket.s3.ap-south-1.amazonaws.com/logo.png'
) {
    const notification = {
        include_player_ids: playerIds,
        // data: { type: 'inbox', ...extraData },
        headings: { en: title },
        contents: { en: message },
        small_icon: 'ic_stat_onesignal_default',
        large_icon: iconUrl || undefined,
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

// ─── Language-Wise Sender ─────────────────────────────────────────────────────
const sendPushNotificationLanguageWise = async (pushData) => {

    const users = await NUSER.find({ deviceToken: { $exists: true, $not: { $size: 0 } } });

    const languageGroups = {};

    for (const user of users) {
        let lang = user.language;
        if (!SUPPORTED_LANGUAGES.includes(lang)) lang = 'en';
        if (lang === 'en') lang = Math.random() < 0.5 ? 'en' : 'enhi';
        if (!languageGroups[lang]) languageGroups[lang] = [];
        languageGroups[lang].push(user);
    }

    const titles = {
        en:   pushData.enhiTitle      || pushData.Title,
        hi:   pushData.hiTitle        || pushData.Title,
        enhi: pushData.enhiTitle      || pushData.Title,
        mr:   pushData.mrTitle        || pushData.Title,
        ta:   pushData.taTitle        || pushData.Title,
    };

    const messages = {
        en:   pushData.enhiDescription || pushData.Description,
        hi:   pushData.hiDescription   || pushData.Description,
        enhi: pushData.enhiDescription || pushData.Description,
        mr:   pushData.mrDescription   || pushData.Description,
        ta:   pushData.taDescription   || pushData.Description,
    };

    const TEST_MODE = false; // Set to true to send only to test player IDs (for development/testing)
    const TEST_PLAYER_IDS = [
        "95d70d90-3044-4681-8c21-1f1ca45f9335",
        "b508f818-cdba-4656-9bc9-fac3b1fafadb",
        "a2259499-f64e-4556-a91f-e566b8765ec2",
        "6b3c0122-e8f8-4641-984e-afdfaa56b4a5",
    ];

    let totalSent = 0;

    for (const lang in languageGroups) {
        try {
            const usersList = languageGroups[lang];

            const playerIds = TEST_MODE
                ? TEST_PLAYER_IDS
                : [
                    ...new Set(
                        usersList
                            .flatMap(u => u.deviceToken)
                            .filter(id => id && isValidUUID(id))
                    ),
                ];

            if (!playerIds.length) {
                console.log(`⚠️  No valid player IDs for lang=${lang}, skipping`);
                continue;
            }

            const batches = chunkArray(playerIds);

            for (const batch of batches) {
                const result = await sendBulkNotification(
                    batch,
                    titles[lang],
                    messages[lang],
                    { lang, timestamp: new Date().toISOString() }
                );
                if (result.success) totalSent += batch.length;
            }

            console.log(`✅ lang=${lang} done (${playerIds.length} users)`);
        } catch (err) {
            console.error(`❌ lang=${lang} error:`, err.message);
        }
    }

    return { recipients: totalSent };
};

// ─── Pick Random Notification & Send ─────────────────────────────────────────
let isNotificationSending = false;

const sendRandomAutoNotification = async () => {
    if (isNotificationSending) {
        console.log('⏳ Already in progress. Skipping...');
        return;
    }
    isNotificationSending = true;

    try {
        const notifications = await NOTIFICATION.find();

        if (!notifications.length) {
            console.log('📭 No auto-notifications found in database');
            return;
        }

        const random = notifications[Math.floor(Math.random() * notifications.length)];

        console.log(`\n🔔 Sending auto-notification to all users:`);
        console.log(`   Title:       ${random.Title}`);
        console.log(`   Description: ${random.Description}`);
        console.log(`   random: ${random}`);

        return await sendPushNotificationLanguageWise(random);

    } catch (err) {
        console.error('❌ Error in auto-notification process:', err);
    } finally {
        isNotificationSending = false;
    }
};

// ─── Main ─────────────────────────────────────────────────────────────────────
const main = async () => {
    await Promise.all([
        new Promise(res => connection1.once('connected', res)),
        new Promise(res => connection2.once('connected', res)),
    ]);

    try {
        const result = await sendRandomAutoNotification();

        if (result?.recipients) {
            console.log(`\n✅ SUCCESS! Auto-notification sent to ${result.recipients} users`);
        } else {
            console.log(`\n⚠️  Auto-notification sent (recipient count unknown)`);
        }
    } catch (err) {
        console.error('❌ Main process error:', err);
    } finally {
        console.log('\n🏁 Process completed');
        await connection1.close();
        await connection2.close();
        process.exit(0);
    }
};

main();