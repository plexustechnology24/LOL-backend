const COMINGSOON = require('../models/comingSoon');
const COMINGSOONSUGGESTION = require('../models/comingSoonSuggestion');
const COMINGSOONVOTE = require('../models/comingSoonVote'); 
const { convertToHinglish, translateText } = require('../utils/translator');


exports.Create = async function (req, res, next) {
    try {

        const { Title, Description } = req.body;


        if (Title) {
            req.body.hiTitle = await translateText(Title, "en", "hi");
            // req.body.taTitle = await translateText(Title, "en", "ta");
            req.body.mrTitle = await translateText(Title, "en", "mr");
        }

        if (Description) {
            req.body.hiDescription = await translateText(Description, "en", "hi");
            // req.body.taDescription = await translateText(Description, "en", "ta");
            req.body.mrDescription = await translateText(Description, "en", "mr");
        }

        const dataCreate = await COMINGSOON.create(req.body);

        res.status(201).json({
            status: 1,
            message: 'Data Created Successfully',
            data: dataCreate,
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};


exports.Read = async function (req, res, next) {
    try {

        const COMINGSOONData = await COMINGSOON.find();

        res.status(200).json({
            status: 1,
            message: 'Data Found Successfully',
            data: COMINGSOONData,
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};

exports.SuggestionRead = async function (req, res, next) {
    try {
        const { page = 1, limit = 15, } = req.body;
        const skip = (page - 1) * limit;

        const filter = {};

        const total = await COMINGSOONSUGGESTION.countDocuments(filter);
        const data = await COMINGSOONSUGGESTION.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        res.status(200).json({
            status: 1,
            message: 'Suggestion Found Successfully',
            data: data,
            pagination: {
                total: total,
                totalPages: Math.ceil(total / limit),
                currentPage: parseInt(page),
                limit: parseInt(limit)
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

        const { Title, Description } = req.body;


        if (Title) {
            req.body.hiTitle = await translateText(Title, "en", "hi");
            // req.body.taTitle = await translateText(Title, "en", "ta");
            req.body.mrTitle = await translateText(Title, "en", "mr");
        }

        if (Description) {
            req.body.hiDescription = await translateText(Description, "en", "hi");
            // req.body.taDescription = await translateText(Description, "en", "ta");
            req.body.mrDescription = await translateText(Description, "en", "mr");
        }

        const dataUpdate = await COMINGSOON.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.status(200).json({
            status: 1,
            message: 'App Updated Successfully',
            data: dataUpdate,
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
        const { id } = req.params;
        const { type } = req.body; // ?type=suggestion

        let data;

        // 🔥 Suggestion delete
        if (type === 'suggestion') {
            data = await COMINGSOONSUGGESTION.findByIdAndDelete(id);
        } 
        else {
            data = await COMINGSOON.findByIdAndDelete(id);
        }

        if (!data) {
            return res.status(404).json({
                status: 0,
                message: 'Data Not Found'
            });
        }

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
};;

exports.Find = async function (req, res, next) {
    try {

        const lan = req.body.lan || 'en';

        let titleField = 'Title';
        let descriptionField = 'Description';

        switch (lan) {
            case 'hi':
                titleField = 'hiTitle';
                descriptionField = 'hiDescription';
                break;

            case 'mr':
                titleField = 'mrTitle';
                descriptionField = 'mrDescription';
                break;

            // case 'ta':
            //     titleField = 'taTitle';
            //     descriptionField = 'taDescription';
            //     break;

            case 'enhi':
                titleField = 'enhiTitle';
                descriptionField = 'enhiDescription';
                break;

            default:
                titleField = 'Title';
                descriptionField = 'Description';
        }

        const data = await COMINGSOON.find().select(
            `${titleField} ${descriptionField} Image fakeVotes _id`
        );

        const formattedData = data.map(item => ({
            _id: item._id,
            Title: item[titleField],
            Description: item[descriptionField],
            Image: item.Image,
            fakeVotes: item.fakeVotes
        }));

        res.status(200).json({
            status: 1,
            message: 'Data Fetched Successfully',
            data: formattedData
        });

    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};


exports.AddOriginalVote = async function (req, res) {
    try {
        const { id } = req.params; 

        if (!req.body.id) {
            throw new Error("Id is required");
        }

        // 🔍 Step 1: find user by email
        let user = await COMINGSOONVOTE.findOne({ email : req.body.id });

        // 🆕 Step 2: if user not exists → create new
        if (!user) {
            await COMINGSOONVOTE.create({
                email: req.body.id,
                votes: [
                    {
                        comingSoonId: id,
                        vote: 1
                    }
                ]
            });

        } else {
            // 🔍 Step 3: check if already voted for this comingSoonId
            const existingVote = user.votes.find(
                v => v.comingSoonId.toString() === id
            );

            if (existingVote) {
                // ➕ increase vote
                existingVote.vote += 1;
            } else {
                // ➕ new entry
                user.votes.push({
                    comingSoonId: id,
                    vote: 1
                });
            }

            await user.save();
        }

        if (id == 1) {
            const { suggestion } = req.body;

            if (!suggestion) {
                throw new Error("Suggestion is required")
            }

            const newSuggestion = await COMINGSOONSUGGESTION.create({
                suggestions: suggestion
            });

            return res.status(200).json({
                status: 1,
                message: 'Suggestion Added Successfully',
                // data: newSuggestion
            });
        } else {

            // ✅ Normal vote increment
            const data = await COMINGSOON.findByIdAndUpdate(
                id,
                { $inc: { originalVotes: 1 } },
                { new: true }
            );

            if (!data) {
                throw new Error("Data Not Found")
            }

            res.status(200).json({
                status: 1,
                message: 'Vote Added Successfully',
                // data: data
            });

        }

    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message
        });
    }
};

exports.GetVoteAnalytics = async (req, res) => {
    try {
        const data = await COMINGSOONVOTE.find();

        let voteDistribution = {};
        let totalVotes = 0;
        let uniqueItems = new Set();

        let emailList = []; // 👈 NEW

        data.forEach(user => {
            const voteCount = user.votes.length;

            // 📊 Distribution
            voteDistribution[voteCount] = (voteDistribution[voteCount] || 0) + 1;

            let userTotalVotes = 0;

            user.votes.forEach(v => {
                totalVotes += v.vote;
                userTotalVotes += v.vote;
                uniqueItems.add(v.comingSoonId.toString());
            });

            // 📋 Email-wise data
            emailList.push({
                email: user.email,
                itemsVoted: voteCount,     // ketla item ma vote
                totalVotes: userTotalVotes // total votes
            });
        });

        const chartData = Object.keys(voteDistribution).map(key => ({
            votes: Number(key),
            users: voteDistribution[key]
        }));

        return res.status(200).json({
            status: 1,
            data: {
                distribution: chartData,
                emailList // 👈 table mate ready data
            }
        });

    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message
        });
    }
};
