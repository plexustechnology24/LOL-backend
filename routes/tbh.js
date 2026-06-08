const express = require('express');
const router = express.Router();
const tbhController = require('../controllers/tbh');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const Tbh = require('../models/tbh'); // Adjust path as per your project

// Configure S3 client
const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_KEY
    }
});

// Use multer memory storage
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/gif',
            'image/svg+xml',
            'video/mp4',
            'video/quicktime',
            'video/x-msvideo'
        ];

        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only images (including SVG) and videos are allowed.'));
        }
    }
});

// Generate unique filename
function generateUniqueFilename(originalName) {
    const extension = path.extname(originalName);
    const uniqueId = uuidv4();
    return `TbhImage-${uniqueId}${extension}`;
}

// Delete file from S3
async function deleteFromS3(fileUrl, bucketName) {
    try {
        const urlParts = fileUrl.split('.s3.amazonaws.com/');
        if (urlParts.length !== 2) {
            console.error('Invalid S3 URL format');
            return false;
        }

        const key = urlParts[1];

        // Skip default/placeholder files
        if (key.includes('Default')) {
            return false;
        }

        await s3Client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }));
        console.log('Successfully deleted old file from S3:', key);
        return true;
    } catch (error) {
        console.error('Error deleting from S3:', error);
        return false;
    }
}

// Upload file to S3
async function uploadToS3(file, bucketName, folderPath = '') {
    try {
        const filename = generateUniqueFilename(file.originalname);
        const key = folderPath ? `${folderPath}/${filename}` : filename;

        let contentType = file.mimetype;
        if (!contentType) {
            const ext = path.extname(file.originalname).toLowerCase();
            contentType = ext === '.svg' ? 'image/svg+xml' : 'image/jpeg';
        }

        const uploadParams = {
            Bucket: bucketName,
            Key: key,
            Body: file.buffer,
            ContentType: contentType,
            CacheControl: 'public, max-age=31536000',
            ContentDisposition: 'inline'
        };

        await s3Client.send(new PutObjectCommand(uploadParams));

        return {
            filename,
            url: `https://${bucketName}.s3.amazonaws.com/${key}`
        };
    } catch (error) {
        console.error('Error uploading to S3:', error);
        throw error;
    }
}

// Upload TBH image to S3
async function uploadTbhImageToS3(file, folderPath = 'images/tbh') {
    const bucketName = process.env.AWS_BUCKET_NAME;
    try {
        return await uploadToS3(file, bucketName, folderPath);
    } catch (error) {
        throw new Error(`Upload failed: ${error.message}`);
    }
}

// =============================== TBH Routes ================================

router.post('/create', upload.single('CardImage'), async (req, res, next) => {
    try {
        if (req.file) {
            const { filename, url } = await uploadTbhImageToS3(req.file);
            req.file.filename = filename;
            req.file.s3Url = url;
        }
        tbhController.ContentCreate(req, res, next);
    } catch (error) {
        console.error('Error during TBH create:', error);
        res.status(500).json({
            error: 'TBH image upload failed',
            details: error.message
        });
    }
});

router.post('/read', tbhController.ContentRead);

router.patch('/update/:id', upload.single('CardImage'), async (req, res, next) => {
    try {
        if (req.file) {
            const { id } = req.params;
            const currentTbh = await Tbh.findById(id);

            if (currentTbh && currentTbh.TbhImage) {
                const bucketName = process.env.AWS_BUCKET_NAME;
                await deleteFromS3(currentTbh.TbhImage, bucketName);
            }

            const { filename, url } = await uploadTbhImageToS3(req.file);
            req.file.filename = filename;
            req.file.s3Url = url;
        }
        tbhController.ContentUpdate(req, res, next);
    } catch (error) {
        console.error('Error during TBH update:', error);
        res.status(500).json({
            error: 'TBH image upload failed',
            details: error.message
        });
    }
});

router.delete('/delete/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const currentTbh = await Tbh.findById(id);

        if (currentTbh && currentTbh.TbhImage) {
            const bucketName = process.env.AWS_BUCKET_NAME;
            await deleteFromS3(currentTbh.TbhImage, bucketName);
        }

        tbhController.ContentDelete(req, res, next);
    } catch (error) {
        console.error('Error during TBH delete:', error);
        res.status(500).json({
            error: 'TBH deletion failed',
            details: error.message
        });
    }
});

router.post('/get', upload.none(), tbhController.ContentGetByLang);

module.exports = router;