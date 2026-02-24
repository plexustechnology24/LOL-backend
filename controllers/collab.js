const COLLAB = require('../models/collab');


exports.Create = async function (req, res, next) {
    try {
        const { id, email, name, number, city, instaId, snapId, tiktokId } = req.body;

        if (!instaId && !snapId && !tiktokId) {
            throw new Error("At least one social ID (Instagram, Snapchat, or TikTok) is required");
        }

        if (
            req.body.number &&
            (
                !Number.isInteger(Number(req.body.number))
            )
        ) {
            throw new Error("Please enter a valid phone number");
        }

        const emailExists = await COLLAB.findOne({ id });
        if (emailExists) {
            throw new Error("This Id Collab already exists")
        }

        const datacreate = await COLLAB.create(req.body);
        res.status(201).json({
            status: 1,
            message: 'Collab Data Added Successfully'
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};

exports.Create2 = async function (req, res, next) {
    try {
        const { type, email, name, number, city, instaId, snapId, tiktokId } = req.body;

        if (!instaId && !snapId && !tiktokId) {
            throw new Error("At least one social ID (Instagram, Snapchat, or TikTok) is required");
        }

        if (
            req.body.number &&
            (
                !Number.isInteger(Number(req.body.number))
            )
        ) {
            throw new Error("Please enter a valid phone number");
        }

        const datacreate = await COLLAB.create(req.body);
        res.status(201).json({
            status: 1,
            message: 'Collab Data Added Successfully'
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};

// ================================================================================

exports.Read = async function (req, res, next) {
    try {
        // Extract pagination parameters from request
        const page = parseInt(req.body.page) || 1;
        const limit = parseInt(req.body.limit) || 15;
        const skip = (page - 1) * limit;
        const searchTerm = req.body.search || ''; // Get search term from request

        // Build query object
        let query = {};
        if (searchTerm.trim() !== '') {
            query.$or = [
                { email: { $regex: searchTerm, $options: 'i' } },
                { name: { $regex: searchTerm, $options: 'i' } },
                { instaId: { $regex: searchTerm, $options: 'i' } },
                { snapId: { $regex: searchTerm, $options: 'i' } },
                { tiktokId: { $regex: searchTerm, $options: 'i' } },
                { city: { $regex: searchTerm, $options: 'i' } },
                { number: { $regex: searchTerm, $options: 'i' } },
                { type: { $regex: searchTerm, $options: 'i' } }
            ];
        }

        // Get total count for pagination metadata with search filter
        const totalItems = await COLLAB.countDocuments(query);

        // Query with pagination and search
        const data = await COLLAB.find(query)
            .sort({ _id: -1 }) // Newest first
            .skip(skip)
            .limit(limit)
            .lean();

        res.status(200).json({
            status: 1,
            message: 'Data Found Successfully',
            data: data,
            pagination: {
                currentPage: page,
                itemsPerPage: limit,
                totalItems: totalItems,
                totalPages: Math.ceil(totalItems / limit),
                searchTerm: searchTerm // Include search term in response
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

        await COLLAB.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

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

exports.Delete = async function (req, res, next) {
    try {
        const deleted = await COLLAB.findByIdAndDelete(req.params.id);

        if (!deleted) {
            return res.status(404).json({
                status: 0,
                message: "Data not found",
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



exports.Unread = async function (req, res, next) {
    try {
        const count = await COLLAB.countDocuments({ read: false });
        res.json({ count });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};




