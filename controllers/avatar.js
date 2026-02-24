const AVATAR = require('../models/avatar');

exports.Create = async function (req, res, next) {
    try {
        if (!req.uploadedUrls || req.uploadedUrls.length === 0) {
            return res.status(400).json({
                status: 0,
                message: 'No images uploaded',
            });
        }

        // Create separate document for each image URL
        const avatarDocuments = req.uploadedUrls.map(url => ({
            avatar: url
        }));

        // Insert all documents at once
        const createdAvatars = await AVATAR.insertMany(avatarDocuments);

        res.status(201).json({
            status: 1,
            message: `${createdAvatars.length} Avatar(s) Added Successfully`,
            data: createdAvatars,
            count: createdAvatars.length
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
        const { page = 1, limit = 6 } = req.body;
        
        // Convert to numbers and validate
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        
        // Calculate skip value for pagination
        const skip = (pageNum - 1) * limitNum;
        
        // Get total count
        const totalCount = await AVATAR.countDocuments();
        
        // Calculate total pages
        const totalPages = Math.ceil(totalCount / limitNum);
        
        // Check if there are more pages
        const hasMore = pageNum < totalPages;
        
        // Fetch avatars with pagination using aggregation
        const data = await AVATAR.aggregate([
            { $sample: { size: totalCount } }, // Randomize all documents
            { $skip: skip }, // Skip documents for pagination
            { $limit: limitNum }, // Limit results per page
            { $project: { avatar: 1, _id: 0 } }
        ]);

        // Extract avatar URLs
        const avatars = data.map(item => item.avatar);

        res.status(200).json({
            status: 1,
            message: 'Avatars Found Successfully',
            data: avatars,
            pagination: {
                currentPage: pageNum,
                totalPages: totalPages,
                totalCount: totalCount,
                limit: limitNum,
                hasMore: hasMore
            },
            // Alternative response format (backward compatible)
            hasMore: hasMore,
            totalPages: totalPages
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};
