const express = require('express');
const router = express.Router();
const cardBgControllers = require('../controllers/cardBg');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

const CardBg = require('../models/cardBg'); 
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
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
    fileFilter: (req, file, cb) => {
        // Allow only image files and videos
        const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/x-msvideo'];
        cb(null, allowedMimes.includes(file.mimetype));
    }
});

// Function to generate unique filename
function generateUniqueFilename(originalName, suffix = '') {
    const fileName = "UserCardBg";
    const extension = path.extname(originalName);
    const uniqueId = uuidv4();
    return `${fileName}-${uniqueId}${suffix}${extension}`;
}

// Function to delete file from S3
async function deleteFromS3(fileUrl, bucketName) {
    try {
        // Extract the key from the S3 URL
        const urlParts = fileUrl.split('.s3.amazonaws.com/');
        if (urlParts.length !== 2) {
            console.error('Invalid S3 URL format');
            return false;
        }
        
        const key = urlParts[1];
        
        // Don't delete default files (optional - adjust as needed)
        if (key.includes('Default')) {
            return false;
        }

        const deleteParams = {
            Bucket: bucketName,
            Key: key
        };

        await s3Client.send(new DeleteObjectCommand(deleteParams));
        console.log('Successfully deleted file from S3:', key);
        return true;
    } catch (error) {
        console.error('Error deleting from S3:', error);
        return false;
    }
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

// Function to upload user CardBg image to S3
async function uploadUserCardBgToS3(file, folderPath = "images/CardBg") {
    const bucketName = process.env.AWS_BUCKET_NAME;

    try {
        const result = await uploadToS3(file, bucketName, folderPath);
        return {
            filename: result.filename,
            url: result.url
        };
    } catch (error) {
        throw new Error(`CardBg upload failed: ${error.message}`);
    }
}

router.post('/create', upload.single("CardBg"), async (req, res, next) => {
    try {
        if (req.file) {
            // Upload to S3 without compression
            const { filename, url } = await uploadUserCardBgToS3(req.file, "images/CardBg");

            // Store filename and URL in the request object for the controller
            req.file.filename = filename;
            req.file.s3Url = url;
        }

        cardBgControllers.Create(req, res, next);
    } catch (error) {
        console.error('Error during cardBg create:', error);
        res.status(500).json({
            error: 'CardBg upload failed',
            details: error.message
        });
    }
});

router.post('/read', cardBgControllers.Read);

router.patch('/update/:id', upload.single("CardBg"), async (req, res, next) => {
    try {
        if (req.file) {
            // Get current CardBg record before updating
            const { id } = req.params;
            const currentCardBg = await CardBg.findById(id); // Adjust based on your model method
            
            if (currentCardBg && currentCardBg.CardBg) { // Adjust field name as per your schema
                // Delete old file from S3
                const bucketName = process.env.AWS_BUCKET_NAME;
                await deleteFromS3(currentCardBg.CardBg, bucketName);
            }

            // Upload new file to S3
            const { filename, url } = await uploadUserCardBgToS3(req.file, "images/CardBg");
            req.file.filename = filename;
            req.file.s3Url = url;
        }

        cardBgControllers.Update(req, res, next);
    } catch (error) {
        console.error('Error during cardBg update:', error);
        res.status(500).json({
            error: 'CardBg upload failed',
            details: error.message
        });
    }
});

router.delete('/delete/:id', async (req, res, next) => {
    try {
        // Get current CardBg record before deleting
        const { id } = req.params;
        const currentCardBg = await CardBg.findById(id); // Adjust based on your model method
        
        if (currentCardBg && currentCardBg.CardBg) { // Adjust field name as per your schema
            // Delete file from S3
            const bucketName = process.env.AWS_BUCKET_NAME;
            await deleteFromS3(currentCardBg.CardBg, bucketName);
        }

        // Proceed with database deletion
        cardBgControllers.Delete(req, res, next);
    } catch (error) {
        console.error('Error during cardBg delete:', error);
        res.status(500).json({
            error: 'CardBg deletion failed',
            details: error.message
        });
    }
});

module.exports = router;