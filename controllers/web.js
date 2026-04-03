const USERANALYTICS = require('../models2/userAnalytics');
const NUSER = require('../models2/usernew');


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