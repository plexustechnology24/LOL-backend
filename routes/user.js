const express = require('express');
const router = express.Router();
const userControllers = require('../controllers/user');
const NUSER = require('../models2/usernew');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const os = require('os');
const analyticsControllers = require('../controllers/analytics');
const { validateRequestBody, verifyToken, verifyUserId } = require('../middleware/validateRequest');
const { DeleteObjectCommand } = require('@aws-sdk/client-s3');


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
    limits: { fileSize: 15 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        // Allow only image files and videos
        const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/x-msvideo'];
        cb(null, allowedMimes.includes(file.mimetype));
    }
});

// Function to generate unique filename
function generateUniqueFilename(originalName, suffix = '') {
    const fileName = "UserAvatar";
    const extension = path.extname(originalName);
    const uniqueId = uuidv4();
    return `${fileName}-${uniqueId}${suffix}${extension}`;
}

async function deleteFromS3(fileUrl, bucketName) {
    try {
        // Extract the key from the S3 URL
        const urlParts = fileUrl.split('.s3.amazonaws.com/');
        if (urlParts.length !== 2) {
            console.error('Invalid S3 URL format');
            return false;
        }
        
        const key = urlParts[1];
        
        // Don't delete default avatar
        if (key.includes('AvatarDefault')) {
            return false;
        }

        const deleteParams = {
            Bucket: bucketName,
            Key: key
        };

        await s3Client.send(new DeleteObjectCommand(deleteParams));
        console.log('Successfully deleted old avatar from S3:', key);
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

// Function to capture frame from video
async function captureVideoFrame(videoBuffer, originalFilename) {
    return new Promise((resolve, reject) => {
        // Create temporary files
        const tempVideoPath = path.join(os.tmpdir(), `temp_video_${uuidv4()}.mp4`);
        const tempImagePath = path.join(os.tmpdir(), `temp_frame_${uuidv4()}.jpg`);

        try {
            // Write video buffer to temporary file
            fs.writeFileSync(tempVideoPath, videoBuffer);

            // Extract frame at 1 second (or first frame if video is shorter)
            ffmpeg(tempVideoPath)
                .screenshots({
                    count: 1,
                    folder: path.dirname(tempImagePath),
                    filename: path.basename(tempImagePath),
                    timemarks: ['00:00:00.000'] // Extract frame at 1 second
                })
                .on('end', () => {
                    try {
                        // Read the captured frame
                        const frameBuffer = fs.readFileSync(tempImagePath);
                        
                        // Clean up temporary files
                        fs.unlinkSync(tempVideoPath);
                        fs.unlinkSync(tempImagePath);
                        
                        resolve({
                            buffer: frameBuffer,
                            mimetype: 'image/jpeg',
                            originalname: originalFilename.replace(path.extname(originalFilename), '_thumbnail.jpg')
                        });
                    } catch (error) {
                        reject(error);
                    }
                })
                .on('error', (error) => {
                    // Clean up temporary files on error
                    try {
                        if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
                        if (fs.existsSync(tempImagePath)) fs.unlinkSync(tempImagePath);
                    } catch (cleanupError) {
                        console.error('Error cleaning up temp files:', cleanupError);
                    }
                    reject(error);
                });
        } catch (error) {
            reject(error);
        }
    });
}

// Function to upload file with thumbnail generation for videos
async function uploadFileWithThumbnail(file, bucketName, folderPath = '') {
    try {
        const isVideo = file.mimetype.startsWith('video/');
        let results = {};

        // Upload the original file
        const originalResult = await uploadToS3(file, bucketName, folderPath);
        results.original = originalResult;

        // If it's a video, capture and upload thumbnail
        if (isVideo) {
            try {
                const frameData = await captureVideoFrame(file.buffer, file.originalname);
                
                // Create a file-like object for the thumbnail
                const thumbnailFile = {
                    buffer: frameData.buffer,
                    mimetype: frameData.mimetype,
                    originalname: frameData.originalname
                };

                // Upload thumbnail to thumbnails folder
                const thumbnailFolderPath = folderPath.replace('videos/', 'images/thumbnails/');
                const thumbnailResult = await uploadToS3(thumbnailFile, bucketName, thumbnailFolderPath);
                results.thumbnail = thumbnailResult;
            } catch (thumbnailError) {
                console.error('Error generating video thumbnail:', thumbnailError);
                // Continue without thumbnail if generation fails
                results.thumbnail = null;
            }
        }

        return results;
    } catch (error) {
        console.error('Error uploading file with thumbnail:', error);
        throw error;
    }
}

// Function to upload user avatar image to S3
async function uploadUserAvatarToS3(file, folderPath = "images/user") {
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

// Function to upload media with video frame capture
async function uploadMediaWithFrameCapture(file, folderPath) {
    const bucketName = process.env.AWS_BUCKET_NAME;

    try {
        const results = await uploadFileWithThumbnail(file, bucketName, folderPath);
        return results;
    } catch (error) {
        throw new Error(`Media upload failed: ${error.message}`);
    }
}

// Routes
router.get('/callback', upload.none(), userControllers.CallBack);
router.post('/idcheck', upload.none(), validateRequestBody, userControllers.IdExist);
router.post('/pause-link2', upload.none(), validateRequestBody, verifyToken, verifyUserId, userControllers.UpdateLink2);    //old
router.post('/pauselink', upload.none(), validateRequestBody, verifyToken, verifyUserId, userControllers.PauseLink);    //new
router.post('/que/add', upload.none(), validateRequestBody, verifyToken, verifyUserId, userControllers.StaticQue);
router.post('/delete/user', upload.none(), validateRequestBody, verifyToken, verifyUserId, userControllers.DeleteUser);
router.post('/purchase2', upload.none(), validateRequestBody, verifyToken, verifyUserId, userControllers.Purchase2);
router.post('/block-user2', upload.none(), validateRequestBody, verifyToken, verifyUserId, userControllers.BlockUser2);
router.post('/logout', upload.none(), validateRequestBody, verifyToken, verifyUserId, userControllers.Logout);
router.post('/catgory/found', upload.none(), validateRequestBody, userControllers.CategoryWeb);
router.post('/catgory/webinstall', upload.none(), validateRequestBody, userControllers.WebInstall);
router.post('/web/cardpreview', upload.none(), validateRequestBody, userControllers.WebCardPreview);
router.post('/web/emotion/cardpreview', upload.none(), validateRequestBody, userControllers.WebEmotionCardPreview);
router.post('/web/emotion/content', upload.none(), validateRequestBody, userControllers.WebEmotionCardContent);
router.post('/web/challenge/content', upload.none(), validateRequestBody, userControllers.WebChallengeCardContent);
router.post('/web/hotness/cardpreview', upload.none(), validateRequestBody, userControllers.WebHotnessCardPreview);
router.post('/web/friend/cardpreview', upload.none(), validateRequestBody, userControllers.WebFriendCardPreview);
router.post('/web/bluff/cardpreview', upload.none(), validateRequestBody, userControllers.WebBluffCardPreview);
router.post('/web/hotness', upload.none(), validateRequestBody, userControllers.WebRoastHostId);
router.post('/catgory/ip', upload.none(), validateRequestBody, userControllers.CategoryWebIp);
router.post('/purchase/status', upload.none(), validateRequestBody, verifyToken, userControllers.Status);
router.post('/user/verify', upload.none(), validateRequestBody, verifyToken, verifyUserId, userControllers.Verify);
<<<<<<< HEAD
router.post('/credit/check', upload.none(), validateRequestBody, verifyToken, verifyUserId, userControllers.CreditGet); // 2 question
=======
router.post('/credit/check', upload.none(), validateRequestBody, verifyToken, verifyUserId, userControllers.CreditGet);  //2 ques
>>>>>>> 44f0496 (heaven hell share api & playstore change)
router.get('/download', validateRequestBody, analyticsControllers.Download);
// ======================================= 3 question ==============================================
router.post('/annoy/share', upload.none(), validateRequestBody, verifyToken, verifyUserId, userControllers.Annoy);
router.post('/annoy/allcardtitle', upload.none(), validateRequestBody, verifyToken, verifyUserId, userControllers.AnnoyCardtitle);
router.post('/annoy/addcardtitle', upload.none(), validateRequestBody, verifyToken, verifyUserId, userControllers.AnnoyAddCardtitle);

// ======================================= 4 question ==============================================
router.post('/emotion/share', upload.none(), validateRequestBody, verifyToken, verifyUserId, userControllers.Emotion);

// ======================================= 5 question ==============================================
router.post('/confession/share', upload.none(), validateRequestBody, verifyToken, verifyUserId, userControllers.Confession);

// ======================================= 6 question ==============================================
router.post('/hotness/category/all', upload.none(), validateRequestBody, verifyToken, verifyUserId, userControllers.HotnessCategory);

router.post('/hotness/share', upload.none(), validateRequestBody, verifyToken, verifyUserId, userControllers.Hotness);

// ======================================= 7 question ==============================================
router.post('/frndlove/share', upload.none(), validateRequestBody, verifyToken, verifyUserId, userControllers.FrndLove);

// ======================================= 8 question ==============================================
router.post('/roast/share', upload.none(), validateRequestBody, verifyToken, verifyUserId, userControllers.Roast);

// ======================================= 9 question ==============================================
router.post('/bluff/share', upload.none(), validateRequestBody, verifyToken, verifyUserId, userControllers.Bluff);

// ======================================= 10 question ==============================================
router.post('/challenge/share', upload.none(), validateRequestBody, verifyToken, verifyUserId, userControllers.Challenge);

// ======================================= 11 question ==============================================
router.post('/heavenhell/share', upload.none(), validateRequestBody, verifyToken, verifyUserId, userControllers.HeavenHell);



router.post('/Profile', upload.single("avatar"), validateRequestBody, verifyToken, verifyUserId, async (req, res, next) => {
    try {
        if (req.file) {
            // Upload to S3 without compression
            const { filename, url } = await uploadUserAvatarToS3(req.file, "images/user");

            // Store filename and URL in the request object for the controller
            req.file.filename = filename;
            req.file.s3Url = url;
        }

        userControllers.Profile(req, res, next);
    } catch (error) {
        console.error('Error during user profile create:', error);
        res.status(500).json({
            error: 'Avatar upload failed',
            details: error.message
        });
    }
});

router.post('/update/profile', upload.single("avatar"), validateRequestBody, verifyToken, verifyUserId, async (req, res, next) => {
    try {
        if (req.file) {
            // Get user's current avatar before updating
            const { id } = req.body;
            const currentUser = await NUSER.findOne({ id: id });
            
            if (currentUser && currentUser.avatar) {
                // Delete old avatar from S3
                const bucketName = process.env.AWS_BUCKET_NAME;
                await deleteFromS3(currentUser.avatar, bucketName);
            }
            
            // Upload new avatar to S3
            const { filename, url } = await uploadUserAvatarToS3(req.file, "images/user");
            
            // Store filename and URL in the request object for the controller
            req.file.filename = filename;
            req.file.s3Url = url;
        }
        
        userControllers.ProfileUpdate(req, res, next);
    } catch (error) {
        console.error('Error during profile update:', error);
        res.status(500).json({
            error: 'Avatar upload failed',
            details: error.message
        });
    }
});


// 1 and 2 ques preview api
router.post('/que/share', upload.single("image"), validateRequestBody, verifyToken, verifyUserId, async (req, res, next) => {
    try {
        if (req.file) {
            // Determine folder based on file type
            let folderPath;
            if (req.file.mimetype.startsWith('video/')) {
                folderPath = 'videos/picroast';
            } else {
                folderPath = 'images/picroast';
            }

            // Upload with video frame capture
            const uploadResults = await uploadMediaWithFrameCapture(req.file, folderPath);
            
            // Store original file info
            req.file.filename = uploadResults.original.filename;
            req.file.s3Url = uploadResults.original.url;
            
            // Store thumbnail info if available
            if (uploadResults.thumbnail) {
                req.file.thumbnailFilename = uploadResults.thumbnail.filename;
                req.file.thumbnailUrl = uploadResults.thumbnail.url;  
            }
        }

        userControllers.StaticQueUpdate(req, res, next);
    } catch (error) {
        console.error('Error during media upload:', error);
        res.status(500).json({
            error: 'Media upload failed',
            details: error.message
        });
    }
});

module.exports = router;