const express = require('express');
const router = express.Router();
const avatarControllers = require('../controllers/avatar');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

// Configure S3 client
const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_KEY
    }
});

// Use multer for parsing multipart form data, but store in memory
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit per file
    fileFilter: (req, file, cb) => {
        // Allow only image files
        const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
        cb(null, allowedMimes.includes(file.mimetype));
    }
});

// Function to generate unique filename
function generateUniqueFilename(originalName, suffix = '') {
    const fileName = "Avatar";
    const extension = path.extname(originalName);
    const uniqueId = uuidv4();
    return `${fileName}-${uniqueId}${suffix}${extension}`;
}

// Function to upload file to S3
async function uploadToS3(file, bucketName, folderPath = '') {
    try {
        const filename = generateUniqueFilename(file.originalname);
        const key = folderPath ? `${folderPath}/${filename}` : filename;

        const uploadParams = {
            Bucket: bucketName,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype || 'image/jpeg'
        };

        await s3Client.send(new PutObjectCommand(uploadParams));

        // Return the S3 URL
        const s3Url = `https://${bucketName}.s3.amazonaws.com/${key}`;
        return { filename, url: s3Url };
    } catch (error) {
        console.error('Error uploading to S3:', error);
        throw error;
    }
}

// Function to upload user Avatar image to S3
async function uploadUserAvatarToS3(file, folderPath = "images/Avatar") {
    const bucketName = process.env.AWS_BUCKET_NAME;

    try {
        const result = await uploadToS3(file, bucketName, folderPath);
        return {
            filename: result.filename,
            url: result.url
        };
    } catch (error) {
        throw new Error(`Avatar upload failed: ${error.message}`);
    }
}

// Modified route to handle multiple images (up to 10)
router.post('/create', upload.array("avatars", 30), async (req, res, next) => {
    try {
        if (req.files && req.files.length > 0) {
            // Upload all images to S3
            const uploadPromises = req.files.map(file => 
                uploadUserAvatarToS3(file, "images/Avatar")
            );
            
            const uploadResults = await Promise.all(uploadPromises);
            
            // Store all URLs in the request object for the controller
            req.uploadedUrls = uploadResults.map(result => result.url);
        }

        avatarControllers.Create(req, res, next);
    } catch (error) {
        console.error('Error during avatar upload:', error);
        res.status(500).json({
            error: 'Avatar upload failed',
            details: error.message
        });
    }
});

router.post('/read', avatarControllers.Read);

module.exports = router;