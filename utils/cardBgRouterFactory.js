const express = require('express');
const multer = require('multer');
const { MIME_GROUPS, uploadToS3, deleteFromS3 } = require('./s3Core');

function createCardBgRouter({
    controller,
    model,
    folderPath,
    fieldName = 'CardBg',
    dbField = fieldName,
    routePrefix = '',
    allowSvg = false
}) {
    const router = express.Router();
    const allowedMimes = allowSvg ? MIME_GROUPS.imageVideoSvg : MIME_GROUPS.imageVideo;

    const upload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 15 * 1024 * 1024 },
        fileFilter: (req, file, cb) => cb(null, allowedMimes.includes(file.mimetype))
    });

    const p = (path) => `${routePrefix}${path}`;

    router.post(p('/create'), upload.single(fieldName), async (req, res, next) => {
        try {
            if (req.file) {
                const { filename, url } = await uploadToS3(req.file, folderPath, { prefix: 'UserCardBg', withExtraHeaders: allowSvg });
                req.file.filename = filename;
                req.file.s3Url = url;
            }
            controller.Create(req, res, next);
        } catch (error) {
            console.error('Error during create:', error);
            res.status(500).json({ error: `${fieldName} upload failed`, details: error.message });
        }
    });

    router.post(p('/read'), controller.Read);

    router.patch(p('/update/:id'), upload.single(fieldName), async (req, res, next) => {
        try {
            if (req.file) {
                const { id } = req.params;
                const current = await model.findById(id);
                if (current && current[dbField]) await deleteFromS3(current[dbField]);

                const { filename, url } = await uploadToS3(req.file, folderPath, { prefix: 'UserCardBg', withExtraHeaders: allowSvg });
                req.file.filename = filename;
                req.file.s3Url = url;
            }
            controller.Update(req, res, next);
        } catch (error) {
            console.error('Error during update:', error);
            res.status(500).json({ error: `${fieldName} upload failed`, details: error.message });
        }
    });

    router.delete(p('/delete/:id'), async (req, res, next) => {
        try {
            const { id } = req.params;
            const current = await model.findById(id);
            if (current && current[dbField]) await deleteFromS3(current[dbField]);
            controller.Delete(req, res, next);
        } catch (error) {
            console.error('Error during delete:', error);
            res.status(500).json({ error: `${fieldName} deletion failed`, details: error.message });
        }
    });

    return router;
}

module.exports = createCardBgRouter;