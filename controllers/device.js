const DEVICE = require('../models/device');
const INBOX = require('../models2/inboxnew');
const USER = require('../models2/usernew');

exports.Create = async function (req, res, next) {
    try {
        // Ensure emailIds is an array
        if (req.body.emailIds && !Array.isArray(req.body.emailIds)) {
            req.body.emailIds = [req.body.emailIds];
        }
        
        const datacreate = await DEVICE.create(req.body);
        res.status(201).json({
            status: 1,
            message: 'Device Added Successfully',
            data: datacreate,
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
        const { page = 1, limit = 15, deviceType } = req.body;
        const skip = (page - 1) * limit;

        // Build filter object
        const filter = {};
        if (deviceType) {
            filter.deviceType = deviceType;
        }

        const total = await DEVICE.countDocuments(filter);
        const data = await DEVICE.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        res.status(200).json({
            status: 1,
            message: 'Device Found Successfully',
            data: data,
            pagination: {
                total: total,
                totalPages: Math.ceil(total / limit),
                currentPage: parseInt(page),
                limit: parseInt(limit),
                filter: deviceType ? { deviceType } : null
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
        // Ensure emailIds is an array
        if (req.body.emailIds && !Array.isArray(req.body.emailIds)) {
            req.body.emailIds = [req.body.emailIds];
        }
        
        const updatedCard = await DEVICE.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        res.status(200).json({
            status: 1,
            message: 'Device Updated Successfully',
            data: updatedCard,
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
        const deleted = await DEVICE.findByIdAndDelete(req.params.id);

        if (!deleted) {
            return res.status(404).json({
                status: 0,
                message: "Device not found",
            });
        }

        res.status(200).json({
            status: 1,
            message: 'Device deleted successfully',
            data: deleted
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};

exports.DeleteData = async function (req, res, next) {
    try {
        const { id } = req.body; // id can be single email or array of emails

        if (!id) {
            return res.status(400).json({
                status: 0,
                message: "Email is required"
            });
        }

        // Convert to array if single email provided
        const emails = Array.isArray(id) ? id : [id];

        if (emails.length === 0) {
            return res.status(400).json({
                status: 0,
                message: "At least one email is required"
            });
        }

        const results = {
            successful: [],
            failed: [],
            notFound: []
        };

        // Process each email
        for (const email of emails) {
            try {
                // Delete USER by email
                const user = await USER.findOneAndDelete({ id: email });

                // Delete INBOX entries by email
                const inboxDelete = await INBOX.deleteMany({ id: email });

                // Check if any data was deleted
                if (!user && inboxDelete.deletedCount === 0) {
                    results.notFound.push(email);
                } else {
                    results.successful.push(email);
                }
            } catch (error) {
                results.failed.push({ email, error: error.message });
            }
        }

        // Build response message
        let message = "";
        const messages = [];

        if (results.successful.length > 0) {
            messages.push(`Successfully deleted data for ${results.successful.length} email(s)`);
        }

        if (results.notFound.length > 0) {
            messages.push(`No data found for: ${results.notFound.join(", ")}`);
        }

        if (results.failed.length > 0) {
            messages.push(`Failed to delete: ${results.failed.map(f => f.email).join(", ")}`);
        }

        message = messages.join(". ");

        // Determine status code
        if (results.successful.length === 0) {
            return res.status(404).json({
                status: 0,
                message: results.notFound.length > 0 
                    ? `No data found for: ${results.notFound.join(", ")}`
                    : "Failed to delete data",
                details: results
            });
        }

        res.status(200).json({
            status: 1,
            message: message,
            details: results
        });

    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message
        });
    }
};


