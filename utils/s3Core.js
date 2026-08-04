const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_KEY
    }
});

const bucketName = process.env.AWS_BUCKET_NAME;

/**
 * Generate a unique filename.
 * @param {String} originalName - original file name (used to infer extension if not overridden)
 * @param {String} prefix - e.g. "UserCardBg", "UserAvatar", "Audio"
 * @param {String} [extension] - override extension, e.g. ".mp3" (else derived from originalName)
 */
function generateUniqueFilename(originalName, prefix = 'File', extension) {
    const ext = extension || path.extname(originalName) || '';
    const uniqueId = uuidv4();
    return `${prefix}-${uniqueId}${ext}`;
}

function resolveContentType(mimetype, originalname) {
    if (mimetype) return mimetype;
    const ext = path.extname(originalname || '').toLowerCase();
    if (ext === '.svg') return 'image/svg+xml';
    if (ext === '.mp3') return 'audio/mpeg';
    if (ext === '.mp4') return 'video/mp4';
    return 'image/jpeg';
}

/**
 * Core upload function. Accepts either a multer file object {buffer, mimetype, originalname}
 * or a raw buffer (pass mimetype/originalname via opts).
 *
 * @param {Buffer|Object} fileOrBuffer - multer file object, or raw Buffer
 * @param {String} folderPath - e.g. "images/question9/CardBg"
 * @param {Object} [opts]
 * @param {String} [opts.prefix]          - filename prefix, default "File"
 * @param {String} [opts.mimetype]        - required if fileOrBuffer is a raw Buffer
 * @param {String} [opts.originalname]    - required if fileOrBuffer is a raw Buffer
 * @param {String} [opts.extension]       - force a specific extension (e.g. ".mp3")
 * @param {Boolean} [opts.withExtraHeaders] - add CacheControl + inline ContentDisposition (useful for SVG/public assets)
 */
async function uploadToS3(fileOrBuffer, folderPath, opts = {}) {
    try {
        const isBufferInput = Buffer.isBuffer(fileOrBuffer);
        const buffer = isBufferInput ? fileOrBuffer : fileOrBuffer.buffer;
        const mimetype = opts.mimetype || (isBufferInput ? undefined : fileOrBuffer.mimetype);
        const originalname = opts.originalname || (isBufferInput ? undefined : fileOrBuffer.originalname) || '';

        const filename = generateUniqueFilename(originalname, opts.prefix || 'File', opts.extension);
        const key = folderPath ? `${folderPath}/${filename}` : filename;

        const uploadParams = {
            Bucket: bucketName,
            Key: key,
            Body: buffer,
            ContentType: resolveContentType(mimetype, originalname)
        };

        if (opts.withExtraHeaders) {
            uploadParams.CacheControl = 'public, max-age=31536000';
            uploadParams.ContentDisposition = 'inline';
        }

        await s3Client.send(new PutObjectCommand(uploadParams));

        return { filename, url: `https://${bucketName}.s3.amazonaws.com/${key}` };
    } catch (error) {
        console.error('Error uploading to S3:', error);
        throw new Error(`Upload failed: ${error.message}`);
    }
}

/**
 * Delete a file from S3 given its full URL.
 * @param {String} fileUrl
 * @param {Object} [opts]
 * @param {String} [opts.bucket] - default AWS_BUCKET_NAME
 * @param {String[]} [opts.skipKeywords] - skip deletion if key contains any of these, default ['Default']
 */
async function deleteFromS3(fileUrl, opts = {}) {
    try {
        const targetBucket = opts.bucket || bucketName;
        const skipKeywords = opts.skipKeywords || ['Default'];

        const urlParts = fileUrl.split('.s3.amazonaws.com/');
        if (urlParts.length !== 2) {
            console.error('Invalid S3 URL format');
            return false;
        }

        const key = urlParts[1];
        if (skipKeywords.some(kw => key.includes(kw))) {
            return false;
        }

        await s3Client.send(new DeleteObjectCommand({ Bucket: targetBucket, Key: key }));
        console.log('Successfully deleted file from S3:', key);
        return true;
    } catch (error) {
        console.error('Error deleting from S3:', error);
        return false;
    }
}

// Common multer configs — reuse instead of redefining allowedMimes everywhere
const MIME_GROUPS = {
    imageVideo: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/x-msvideo'],
    imageVideoSvg: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'video/mp4', 'video/quicktime', 'video/x-msvideo'],
    imageOnly: ['image/jpeg', 'image/png', 'image/webp']
};

module.exports = {
    s3Client,
    bucketName,
    generateUniqueFilename,
    uploadToS3,
    deleteFromS3,
    MIME_GROUPS
};