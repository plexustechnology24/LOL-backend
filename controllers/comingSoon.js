const COMINGSOON = require('../models/comingSoon');


exports.Create = async function (req, res, next) {
    try {

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

exports.Update = async function (req, res, next) {
    try {
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
        await COMINGSOON.findByIdAndDelete(req.params.id);
        res.status(204).json({
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

exports.Find = async function (req, res, next) {
    try {
        const data = await COMINGSOON.find().select(
            'Title Description Image fakeVotes _id'
        );

        res.status(200).json({
            status: 1,
            message: 'Data Fetched Successfully',
            data: data
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};


exports.AddOriginalVote = async function (req, res, next) {
    try {
        const { id } = req.params;

        const data = await COMINGSOON.findByIdAndUpdate(
            id,
            { $inc: { originalVotes: 1 } },
            { new: true }
        );

        if (!data) {
            return res.status(404).json({
                status: 0,
                message: 'Data Not Found'
            });
        }

        res.status(200).json({
            status: 1,
            message: 'Vote Added Successfully',
            data: data
        });

    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};

