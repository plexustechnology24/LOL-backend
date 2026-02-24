const HOTNESSCATEGORY = require('../models/hotnessCategory');
const MAINCATEGORY = require('../models/hotnessMainCategory');
const HOTNESSCARDBG = require('../models/hotnessCardBg');
const axios = require('axios');


// =================================== Title =======================================
async function translateText(text, from, to) {
    try {
        const res = await axios.get("https://api.mymemory.translated.net/get", {
            params: {
                q: text,
                langpair: `${from}|${to}`
            }
        });
        return res.data.responseData.translatedText;
    } catch (err) {
        console.error(`Translation error (${to}):`, err.message);
        return text; // fallback: return original text
    }
}

exports.HotnessCategoryCreate = async (req, res) => {
    try {
        const { categoryTitle, subCatergoryTitle, categoryImage2, cardImage2 } = req.body;
        const hicategoryTitle = await translateText(req.body.categoryTitle, "en", "hi");
        const escategoryTitle = await translateText(req.body.categoryTitle, "en", "es");
        const hisubCatergoryTitle = await translateText(req.body.subCatergoryTitle, "en", "hi");
        const essubCatergoryTitle = await translateText(req.body.subCatergoryTitle, "en", "es");

        // The processed files are attached to req by the route
        const categoryId = Number(req.body.categoryId);
        let categoryImage;
        let cardImage;
        const subCatergoryImage = req.subCatergoryImageUrl;

        if (categoryImage2) {
            categoryImage = categoryImage2
        } else {
            categoryImage = req.categoryImageUrl
        }

        if (cardImage2) {
            cardImage = cardImage2
        } else {
            cardImage = req.cardImageUrl
        }

        // Create new category
        const newCategory = new HOTNESSCATEGORY({
            categoryId,
            categoryTitle,
            categoryImage,
            subCatergoryTitle,
            subCatergoryImage,
            cardImage,
            hicategoryTitle,
            escategoryTitle,
            hisubCatergoryTitle,
            essubCatergoryTitle
        });

        const newCategory2 = new MAINCATEGORY({
            categoryId,
            categoryTitle,
            categoryImage,
            subCatergoryTitle,
            subCatergoryImage,
        });

        if (subCatergoryTitle) {
            await newCategory.save();
        }

        await newCategory2.save();

        res.status(201).json({
            success: true,
            message: 'Hotness category created successfully',
            data: newCategory
        });

    } catch (error) {
        console.error('Error creating hotness category:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create hotness category',
            error: error.message
        });
    }
};

exports.HotnessCategoryRead = async function (req, res, next) {
    try {
        const { page = 1, limit = 15, categoryFilter } = req.body;
        const skip = (page - 1) * limit;

        // Build filter based on categoryFilter
        const filter = {};
        if (categoryFilter) {
            filter.categoryTitle = categoryFilter;
        }

        const total = await HOTNESSCATEGORY.countDocuments(filter);
        const data = await HOTNESSCATEGORY.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        // Get all unique categories (regardless of filter)
        const allCategories = await MAINCATEGORY.aggregate([
            {
                $group: {
                    _id: "$categoryTitle",
                    categoryImage: { $first: "$categoryImage" },
                    count: { $sum: 1 },
                    categoryId: { $first: "$categoryId" },
                }
            },
            {
                $project: {
                    _id: 0,
                    title: "$_id",
                    image: "$categoryImage",
                    count: { $subtract: ["$count", 1] },
                    categoryId: "$categoryId",
                }
            },
            {
                $sort: { title: 1 }
            }
        ]);

        res.status(200).json({
            status: 1,
            message: 'HotnessCategory Found Successfully',
            data: data,
            allCategories: allCategories, // Add all categories list
            pagination: {
                total: total,
                totalPages: Math.ceil(total / limit),
                currentPage: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};


exports.HotnessCategoryUpdate = async function (req, res, next) {
    try {

        if (req.categoryImageUrl) {
            req.body.categoryImage = req.categoryImageUrl;
        }

        if (req.subCatergoryImageUrl) {
            req.body.subCatergoryImage = req.subCatergoryImageUrl;
        }

        if (req.cardImageUrl) {
            req.body.cardImage = req.cardImageUrl;
        } else if (req.body.cardImage2) {
            req.body.cardImage = req.body.cardImage2;
        } else if (req.body.removeCardImage === 'true') {
            // Explicitly remove the card image
            req.body.cardImage = null;
        }

        if (req.body.categoryId) {
            req.body.categoryId = Number(req.body.categoryId);
        }

        const updateData = {
            categoryTitle: req.body.categoryTitle,
            categoryImage: req.body.categoryImage,
            hicategoryTitle: await translateText(req.body.categoryTitle, "en", "hi"),
            escategoryTitle: await translateText(req.body.categoryTitle, "en", "es")
        };

        if (req.body.categoryTitle || req.body.categoryImage) {
            const result = await HOTNESSCATEGORY.updateMany(
                { categoryTitle: req.body.oldCategoryTitle },   // FIND
                { $set: updateData }               // UPDATE
            );

            await MAINCATEGORY.updateMany(
                { categoryTitle: req.body.oldCategoryTitle },   // FIND
                { $set: updateData }               // UPDATE
            );
        }

        const data = await HOTNESSCATEGORY.findById(req.params.id)

        if (req.body.subCatergoryTitle) {
            req.body.hisubCatergoryTitle = await translateText(req.body.subCatergoryTitle, "en", "hi");
            req.body.essubCatergoryTitle = await translateText(req.body.subCatergoryTitle, "en", "es");
            const updatedCard = await HOTNESSCATEGORY.findByIdAndUpdate(
                req.params.id,
                req.body,
                { new: true, runValidators: true }
            );
        }





        res.status(200).json({
            status: 1,
            message: 'HotnessCategory Updated Successfully',
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};

exports.HotnessCategoryDelete = async function (req, res, next) {
  try {
    // 🔹 1. Find document first
    const category = await HOTNESSCATEGORY.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        status: 0,
        message: "HotnessCategory not found",
      });
    }

    // 🔹 2. Delete ONE matching MAINCATEGORY record
    const mainCategory = await MAINCATEGORY.findOne({
      categoryTitle: category.categoryTitle
    });

    if (mainCategory) {
      await MAINCATEGORY.deleteOne({ _id: mainCategory._id });
    }

    // 🔹 3. Delete HOTNESSCATEGORY record
    await HOTNESSCATEGORY.findByIdAndDelete(req.params.id);

    res.status(200).json({
      status: 1,
      message: 'HotnessCategory deleted successfully',
      data: category
    });

  } catch (error) {
    res.status(400).json({
      status: 0,
      message: error.message,
    });
  }
};





// =============================================== CardBg ===================================================
exports.Create = async function (req, res, next) {
    try {

        if (req.file) {
            req.body.CardBg = req.file.s3Url;
        }
        const datacreate = await HOTNESSCARDBG.create(req.body);

        res.status(201).json({
            status: 1,
            message: 'CardBg Added Successfully',
            data: datacreate,
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
        const { page = 1, limit = 15, category } = req.body;
        const skip = (page - 1) * limit;

        // Build query filter
        const filter = {};
        if (category && category !== '') {
            filter.Category = category;
        }

        const total = await HOTNESSCARDBG.countDocuments(filter);
        const data = await HOTNESSCARDBG.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        res.status(200).json({
            status: 1,
            message: 'CardBg Found Successfully',
            data: data,
            pagination: {
                total: total,
                totalPages: Math.ceil(total / limit),
                currentPage: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};

exports.Update = async function (req, res, next) {
    try {

        if (req.file) {
            req.body.CardBg = req.file.s3Url;
        }

        const updatedCard = await HOTNESSCARDBG.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        res.status(200).json({
            status: 1,
            message: 'CardBg Updated Successfully',
            data: updatedCard,
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};

exports.Delete = async function (req, res, next) {
    try {
        const deleted = await HOTNESSCARDBG.findByIdAndDelete(req.params.id);

        if (!deleted) {
            return res.status(404).json({
                status: 0,
                message: "CardBg not found",
            });
        }

        res.status(200).json({
            status: 1,
            message: 'CardBg deleted successfully',
            data: deleted
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};