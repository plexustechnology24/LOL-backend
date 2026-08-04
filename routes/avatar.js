const express = require('express');
const router = express.Router();
const avatarControllers = require('../controllers/avatar');
const multer = require('multer');
const { MIME_GROUPS, uploadToS3 } = require('../utils/s3Core');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => cb(null, MIME_GROUPS.imageOnly.includes(file.mimetype))
});

router.post('/create', upload.array("avatars", 30), async (req, res, next) => {
    try {
        if (req.files && req.files.length > 0) {
            const uploadResults = await Promise.all(
                req.files.map(file => uploadToS3(file, 'images/Avatar', { prefix: 'Avatar' }))
            );
            req.uploadedUrls = uploadResults.map(result => result.url);
        }
        avatarControllers.Create(req, res, next);
    } catch (error) {
        console.error('Error during avatar upload:', error);
        res.status(500).json({ error: 'Avatar upload failed', details: error.message });
    }
});

router.post('/read', avatarControllers.Read);

module.exports = router;