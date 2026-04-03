const express = require('express');
const router = express.Router();
const emotionControllers = require('../controllers/emotion');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const CardBg = require('../models/emotionCardBg'); 
const Emoji = require('../models/emotionEmoji'); 

// Configure S3 client
const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_KEY
    }
});

// Use multer for parsing multipart form data, store in memory
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
    fileFilter: (req, file, cb) => {
        // Allow image files including SVG
        const allowedMimes = [
            'image/jpeg', 
            'image/png', 
            'image/webp', 
            'image/gif', 
            'image/svg+xml',  // Added SVG support
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
        console.log('Successfully deleted old file from S3:', key);
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

        // Determine proper content type
        let contentType = file.mimetype;
        if (!contentType) {
            const ext = path.extname(file.originalname).toLowerCase();
            if (ext === '.svg') {
                contentType = 'image/svg+xml';
            } else {
                contentType = 'image/jpeg'; // default fallback
            }
        }

        const uploadParams = {
            Bucket: bucketName,
            Key: key,
            Body: file.buffer,
            ContentType: contentType,
            // Add proper cache control and content disposition for SVG
            CacheControl: 'public, max-age=31536000',
            ContentDisposition: 'inline'
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

// Function to upload user CardBg/Emoji image to S3
async function uploadUserCardBgToS3(file, folderPath = "images/question4/CardBg") {
    const bucketName = process.env.AWS_BUCKET_NAME;

    try {
        const result = await uploadToS3(file, bucketName, folderPath);
        return {
            filename: result.filename,
            url: result.url
        };
    } catch (error) {
        throw new Error(`Upload failed: ${error.message}`);
    }
}

// CardBg Routes
router.post('/cardbg/create', upload.single("CardBg"), async (req, res, next) => {
    try {
        if (req.file) {
            const { filename, url } = await uploadUserCardBgToS3(req.file, "images/question4/CardBg");
            req.file.filename = filename;
            req.file.s3Url = url;
        }
        emotionControllers.Create(req, res, next);
    } catch (error) {
        console.error('Error during create:', error);
        res.status(500).json({
            error: 'CardBg upload failed',
            details: error.message
        });
    }
});

router.post('/cardbg/read', emotionControllers.Read);

router.patch('/cardbg/update/:id', upload.single("CardBg"), async (req, res, next) => {
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
            const { filename, url } = await uploadUserCardBgToS3(req.file, "images/question4/CardBg");
            req.file.filename = filename;
            req.file.s3Url = url;
        }
        emotionControllers.Update(req, res, next);
    } catch (error) {
        console.error('Error during update:', error);
        res.status(500).json({
            error: 'CardBg upload failed',
            details: error.message
        });
    }
});

router.delete('/cardbg/delete/:id', async (req, res, next) => {
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
        emotionControllers.Delete(req, res, next);
    } catch (error) {
        console.error('Error during delete:', error);
        res.status(500).json({
            error: 'CardBg deletion failed',
            details: error.message
        });
    }
});
// =============================== Emoji ====================================
router.post('/emoji/create', upload.single("Emoji"), async (req, res, next) => {
    try {
        if (req.file) {
            const { filename, url } = await uploadUserCardBgToS3(req.file, "images/question4/Emoji");
            req.file.filename = filename;
            req.file.s3Url = url;
        }

        emotionControllers.EmojiCreate(req, res, next);
    } catch (error) {
        console.error('Error during Emoji create:', error);
        res.status(500).json({
            error: 'Emoji upload failed',
            details: error.message
        });
    }
});

router.post('/emoji/read', emotionControllers.EmojiRead);

router.patch('/emoji/update/:id', upload.single("Emoji"), async (req, res, next) => {
    try {
        if (req.file) {
            // Get current Emoji record before updating
            const { id } = req.params;
            const currentEmoji = await Emoji.findById(id); // Adjust based on your model method
            
            if (currentEmoji && currentEmoji.Emoji) { // Adjust field name as per your schema
                // Delete old file from S3
                const bucketName = process.env.AWS_BUCKET_NAME;
                await deleteFromS3(currentEmoji.Emoji, bucketName);
            }

            // Upload new file to S3
            const { filename, url } = await uploadUserCardBgToS3(req.file, "images/question4/Emoji");
            req.file.filename = filename;
            req.file.s3Url = url;
        }
        emotionControllers.EmojiUpdate(req, res, next);
    } catch (error) {
        console.error('Error during Emoji update:', error);
        res.status(500).json({
            error: 'Emoji upload failed',
            details: error.message
        });
    }
});

router.delete('/emoji/delete/:id', async (req, res, next) => {
    try {
        // Get current Emoji record before deleting
        const { id } = req.params;
        const currentEmoji = await Emoji.findById(id); // Adjust based on your model method
        
        if (currentEmoji && currentEmoji.Emoji) { // Adjust field name as per your schema
            // Delete file from S3
            const bucketName = process.env.AWS_BUCKET_NAME;
            await deleteFromS3(currentEmoji.Emoji, bucketName);
        }

        // Proceed with database deletion
        emotionControllers.EmojiDelete(req, res, next);
    } catch (error) {
        console.error('Error during Emoji delete:', error);
        res.status(500).json({
            error: 'Emoji deletion failed',
            details: error.message
        });
    }
});


module.exports = router;