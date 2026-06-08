const TBH = require('../models/tbh');
const { translateText } = require('../utils/translator');

// ─── Helper: strip HTML tags for translation ──────────────────────────────────
const stripHTML = (html = '') => html.replace(/<[^>]*>/g, '').trim();

// ─────────────────────────────────────────────────────────────────────────────
//  CREATE
// ─────────────────────────────────────────────────────────────────────────────
const parseNames = (names) => {
    if (Array.isArray(names)) return names;
    if (typeof names === 'string') {
        try { return JSON.parse(names); } catch { return []; }
    }
    return [];
};

// CREATE
exports.ContentCreate = async function (req, res) {
    try {
        const { color, type } = req.body;
        const names = parseNames(req.body.names);   // ← fix #1

        if (!type) return res.status(400).json({ status: 0, message: 'type is required' });
        if (!req.file) return res.status(400).json({ status: 0, message: 'CardImage is required' });  // ← fix #2

        if (Array.isArray(names)) {
            for (const nameObj of names) {
                if (nameObj.questions?.en?.length) {
                    const enQuestions = nameObj.questions.en;
                    nameObj.questions.hi = await Promise.all(enQuestions.map(q => translateText(q, 'en', 'hi').catch(() => q)));
                    nameObj.questions.mr = await Promise.all(enQuestions.map(q => translateText(q, 'en', 'mr').catch(() => q)));
                }
            }
        }

        const doc = await TBH.create({ color, type, names, CardImage: req.file.s3Url });

        return res.status(201).json({ status: 1, message: 'TBH Content Added Successfully', data: doc });
    } catch (error) {
        return res.status(400).json({ status: 0, message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  READ  (paginated)
// ─────────────────────────────────────────────────────────────────────────────
exports.ContentRead = async function (req, res) {
    try {
        const { page = 1, limit = 15, type } = req.body;
        const skip = (page - 1) * parseInt(limit);

        const filter = {};
        if (type && type !== '') filter.type = type;

        const total = await TBH.countDocuments(filter);
        const data  = await TBH.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        return res.status(200).json({
            status: 1,
            message: 'TBH Content Found Successfully',
            data,
            pagination: {
                total,
                totalPages: Math.ceil(total / parseInt(limit)),
                currentPage: parseInt(page),
                limit: parseInt(limit),
            },
        });
    } catch (error) {
        return res.status(400).json({ status: 0, message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  UPDATE
// ─────────────────────────────────────────────────────────────────────────────

exports.ContentUpdate = async function (req, res) {
    try {
        const { color, type } = req.body;
        const names = parseNames(req.body.names);   // ← fix #1

        if (Array.isArray(names)) {
            for (const nameObj of names) {
                if (nameObj.questions?.en?.length) {
                    const enQuestions = nameObj.questions.en;
                    nameObj.questions.hi = await Promise.all(enQuestions.map(q => translateText(q, 'en', 'hi').catch(() => q)));
                    nameObj.questions.mr = await Promise.all(enQuestions.map(q => translateText(q, 'en', 'mr').catch(() => q)));
                }
            }
        }

        const updatePayload = { color, type, names };
        if (req.file?.s3Url) updatePayload.CardImage = req.file.s3Url;  // ← fix #2 (optional chaining)

        const updated = await TBH.findByIdAndUpdate(req.params.id, updatePayload, { new: true, runValidators: true });

        if (!updated) return res.status(404).json({ status: 0, message: 'Content not found' });

        return res.status(200).json({ status: 1, message: 'TBH Content Updated Successfully', data: updated });
    } catch (error) {
        return res.status(400).json({ status: 0, message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  DELETE (single)
// ─────────────────────────────────────────────────────────────────────────────
exports.ContentDelete = async function (req, res) {
    try {
        const deleted = await TBH.findByIdAndDelete(req.params.id);

        if (!deleted) {
            return res.status(404).json({ status: 0, message: 'Content not found' });
        }

        return res.status(200).json({
            status: 1,
            message: 'TBH Content deleted successfully',
            data: deleted,
        });
    } catch (error) {
        return res.status(400).json({ status: 0, message: error.message });
    }
};

exports.ContentGetByLang = async function (req, res) {
    try {
        let { lan } = req.body;

        console.log(req.body);
        

        const validLangs = ['en', 'hi', 'mr', 'enhi'];

        // Default English
        if (!validLangs.includes(lan)) {
            lan = 'en';
        }

        const { type } = req.query;

        const filter = {};
        if (type && type !== '') filter.type = type;

        const docs = await TBH.find(filter).lean();

        const data = docs.map(doc => ({                                        
            _id: doc._id,
            color: doc.color,
            type: doc.type,
            names: (doc.names || []).map(nameObj => ({
                name: nameObj.name,
                encodedName: nameObj.encodedName,
                questions: nameObj.questions?.[lan] || nameObj.questions?.en || [],
            })),
        }));

        return res.status(200).json({
            status: 1,
            message: `TBH Content fetched for language: ${lan}`,
            data,
        });
    } catch (error) {
        return res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};