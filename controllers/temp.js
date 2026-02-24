const TEMP = require('../models/temp');

exports.Create = async function (req, res, next) {
    try {
        
        const create = await TEMP.create(req.body);

        res.status(201).json({
            status: 1,
            message: `Data Added Successfully`,
            data: create,
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
        const dataFind = await TEMP.find();

        res.status(200).json({
            status: 1,
            message: 'Data Found Successfully',
            data: dataFind
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
        const deleted = await TEMP.findByIdAndDelete(req.params.id);

        if (!deleted) {
            return res.status(404).json({
                status: 0,
                message: "CardBg not found",
            });
        }

        res.status(200).json({
            status: 1,
            message: 'Data deleted successfully',
            data: deleted
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};