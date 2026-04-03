const USERANALYTICS = require('../models2/userAnalytics');
const NUSER = require('../models2/usernew');

async function updateReplyAndBadge(userId, categoryname,) {
    try {

        const user = await NUSER.findOne({ id: userId });
        if (!user) {
            throw new Error('User not found');
        }
        // ── 2. User-level reply count ─────────────────────────────────
        const updated = await USERANALYTICS.findOneAndUpdate(
            { id: userId, "questions.category": categoryname },
            { $inc: { "questions.$.reply": 1 } },
            { new: true }
        );
        if (!updated) {
            await USERANALYTICS.findOneAndUpdate(
                { id: userId },
                { $push: { questions: { category: categoryname, view: 0, reply: 1 } } },
                { upsert: true }
            );
        }

        // ── 3. Badge calculation ──────────────────────────────────────
        const analytics = await USERANALYTICS.findOne({ id: userId });
        let total = 0;
        if (analytics?.questions?.length > 0) {
            total = analytics.questions.reduce(
                (sum, q) => sum + (q.share || 0) + (q.reply || 0), 0
            );
        }

        const getBadge = (t) =>
            t >= 200 ? ["Famous", "famous.png"] :
                t >= 100 ? ["Trending", "trending.png"] :
                    t >= 40 ? ["Popular", "popular.png"] :
                        t >= 10 ? ["Active", "active.png"] :
                            ["New", "new.png"];

        const [badge, image] = getBadge(total);
        user.badge = badge;
        user.badgeImage = `https://lol-image-bucket.s3.ap-south-1.amazonaws.com/${image}`;
        // NOTE: caller must await user.save() — we don't save here so
        // the caller can batch other field updates in the same save().
        await user.save()

    } catch (err) {
        // Fire-and-forget: log but never crash the main request
        console.error("[updateShareAndBadge] background error:", err.message);
    }
}

module.exports = { updateReplyAndBadge };