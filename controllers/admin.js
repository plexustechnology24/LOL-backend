const ADMIN = require('../models/admin')
var jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const INBOX = require('../models2/inboxnew');
const USER = require('../models2/usernew');
const NOTIFICATION = require('../models/autonotification');
const PUSHNOTIFICATION = require('../models/pushnotification');
const CATEGORY = require('../models/category');
const CATEGORYANALYTICS = require('../models/categoryanalytics');
const EMOTIONCARDBG = require('../models/emotionCardBg');
const EMOTIONEMOJI = require('../models/emotionEmoji');
const EMOTIONCONTENT = require('../models/emotionContent');
const CHALLENGECONTENT = require('../models/challengeContent');
const DEVICE = require('../models/device');
const NUSER = require('../models2/usernew');
const CONTENT = require('../models/content');
const HOTENESSCATEGORY = require('../models/hotnessCategory');
const MAINCATEGORY = require('../models/hotnessMainCategory');
const HOTENESSCARBG = require('../models/hotnessCardBg');
const FRIENDCARBG = require('../models/friendCardBg');
const BLUFFCARBG = require('../models/bluffCardBg');
const TEMP = require('../models/temp');
const COLLAB = require('../models/collab');



exports.sequre = async function (req, res, next) {
  try {
    let token = req.headers.authorization
    if (!token) {
      throw new Error('please send Token')
    }
    var decoded = jwt.verify(token, 'KEY');  // invalid signature (for wrong key) , jwt malformed(For wrong token)
    let userCheck = await ADMIN.findById(decoded.id) //if id is wrong throw this msg
    if (!userCheck) {
      throw new Error("user not found")
    }
    req.userId = decoded.id
    next()
  } catch (error) {
    res.status(404).json({
      status: 0,
      message: error.message
    })
  }
}


//ADMIN
exports.AdminSignup = async function (req, res, next) {
  try {

    if (!req.body.email || !req.body.pass) {
      throw new Error('Enter All Fields')
    }

    req.body.pass = await bcrypt.hash(req.body.pass, 8)
    let dataCreate = await ADMIN.create(req.body)

    res.status(201).json({
      status: 1,
      message: "Admin Signup Successfully",
      data: dataCreate
    })
  } catch (error) {
    res.status(400).json({
      status: 0,
      message: error.message
    })
  }
}


exports.AdminLogin = async function (req, res, next) {
  try {

    if (!req.body.email || !req.body.pass) {
      throw new Error('Enter All Fields')
    }
    let dataFind = await ADMIN.findOne({ email: req.body.email })
    if (!dataFind) {
      throw new Error("Email Id Not Found")
    }
    let passwordverify = await bcrypt.compare(req.body.pass, dataFind.pass)
    if (!passwordverify) {
      throw new Error("password is worng")
    }
    var token = jwt.sign({ id: dataFind._id }, 'KEY')
    res.status(201).json({
      status: 1,
      message: "Admin login Successfully",
      data: dataFind,
      token
    })
  } catch (error) {
    res.status(400).json({
      status: 0,
      message: error.message
    })
  }
}

exports.AdminRead = async function (req, res, next) {
  try {

    const dataFind = await ADMIN.find();
    res.status(200).json({
      status: "Success!",
      message: "Data Found Successfully",
      data: dataFind
    });
  } catch (error) {
    console.error('Error finding Admin:', error);
    res.status(400).json({
      status: "Fail!",
      message: error.message
    });
  }
};


exports.AdminUpdate = async function (req, res, next) {
  try {

    let dataUpdate = await ADMIN.findByIdAndUpdate(req.params.id, req.body, { new: true })

    res.status(201).json({
      status: 1,
      message: "Update Successfully",
      data: dataUpdate
    })
  } catch (error) {
    res.status(400).json({
      status: 0,
      message: error.message
    })
  }
}


exports.Dashboard = async function (req, res, next) {
  try {
    const inboxCount = await INBOX.countDocuments();
    const userCount = await USER.countDocuments();
    const autoCount = await NOTIFICATION.countDocuments();
    const pushCount = await PUSHNOTIFICATION.countDocuments();

    res.status(200).json({
      status: 1,
      message: 'Dashboard data fetched successfully',
      inboxCount,
      userCount,
      autoCount,
      pushCount
    });

  } catch (error) {
    res.status(400).json({
      status: 0,
      message: error.message,
    });
  }
};


exports.CategoryCreate = async function (req, res, next) {
  try {
    const { categoryname } = req.body;

    if (!categoryname) {
      throw new Error('categoryname value is required');
    }

    // Check if category already exists
    const existingCategory = await CATEGORY.findOne({ 'category.name': categoryname });
    if (existingCategory) {
      throw new Error("Category already existed");
    }

    // Check if this category exists in any user's question.category
    const userWithCategory = await USER.findOne({
      'question.category': categoryname
    });

    // if (!userWithCategory) {
    //   throw new Error("Category not match");
    // }

    // Proceed to create category
    const newCategory = new CATEGORY({
      category: {
        name: categoryname,
        open: 0,
        share: 0,
        admin: true
      }
    });

    await newCategory.save();

    res.status(200).json({
      status: 1,
      message: 'New Category Added',
      created: true,
      data: newCategory
    });

  } catch (error) {
    res.status(400).json({
      status: 0,
      message: error.message,
    });
  }
};



exports.CategoryFind = async (req, res) => {
  try {
    let { since, until } = req.body;

    if (!since) {
      throw new Error("'since' date is required.");
    }

    // If until missing → set same as since
    if (!until) {
      until = since;
    }

    // Fetch all categories
    const categories = await CATEGORY.find().select('category.name');

    // Fetch analytics only for given date range
    let analyticsData = await CATEGORYANALYTICS.aggregate([
      {
        $match: {
          date: { $gte: since, $lte: until }
        }
      },
      {
        $group: {
          _id: "$category",
          open: { $sum: "$open" },
          share: { $sum: "$share" }
        }
      },
      {
        $project: {
          _id: 0,
          category: "$_id",
          open: 1,
          share: 1
        }
      }
    ]);

    // Convert analytics array → Map
    const analyticsMap = new Map(
      analyticsData.map(a => [a.category, { open: a.open, share: a.share }])
    );

    // Add missing categories to analyticsData (with 0,0)
    categories.forEach(cat => {
      const catName = cat.category.name;

      if (!analyticsMap.has(catName)) {
        analyticsData.push({
          category: catName,
          open: 0,
          share: 0
        });
      }
    });

    // Sort analyticsData for clean output (optional)
    analyticsData.sort((a, b) => a.category.localeCompare(b.category));

    return res.status(200).json({
      status: 1,
      message: "Category analytics fetched successfully",
      data: analyticsData
    });

  } catch (error) {
    return res.status(500).json({
      status: 0,
      message: error.message
    });
  }
};



exports.CategoryDelete = async function (req, res, next) {
  try {
    await CATEGORY.findByIdAndDelete(req.params.id);
    res.status(204).json({
      status: 1,
      message: 'Category Deleted Successfully',
    });
  } catch (error) {
    res.status(400).json({
      status: 0,
      message: error.message,
    });
  }
};


exports.Monitoring = async function (req, res, next) {
  try {
    const { categoryname } = req.body;

    if (!categoryname) {
      throw new Error("categoryname is required");
    }

    const categoryDoc = await CATEGORY.findOne({ 'category.name': categoryname });

    // const today = new Date().toISOString().split('T')[0];
    // await CATEGORYANALYTICS.findOneAndUpdate(
    //   { date: today, category: categoryname },
    //   { $inc: { open: 1 } },
    //   { upsert: true, new: true }
    // );

    const user = await NUSER.findOne({ id: req.body.id });

    const deviceIds = await DEVICE.find().select("deviceId -_id");
    const idList = deviceIds.map(d => d.deviceId);
    const alreadyShared = idList.some(id => user.deviceId.includes(id));
    if (!alreadyShared) {
      // share increment only once per device
      const today = new Date().toISOString().split("T")[0];
      await CATEGORYANALYTICS.findOneAndUpdate(
        { date: today, category: categoryname },
        { $inc: { share: 1 } },
        { upsert: true, new: true }
      );
    }

    res.status(200).json({
      status: 1,
      message: 'Category value updated successfully',
      data: categoryDoc,
    });

  } catch (error) {
    res.status(400).json({
      status: 0,
      message: error.message,
    });
  }
};

// ============================ delete multiple ============================
exports.UserDeleteMultiple = async function (req, res, next) {
  try {
    const { TypeId, ids } = req.body;
    console.log(TypeId);
    

    if (!ids || !Array.isArray(ids)) {
      throw new Error('Invalid or missing ids array');
    }

    let Model;

    switch (TypeId) {
      case '1':
        Model = EMOTIONCARDBG;
        break;
      case '2':
        Model = EMOTIONEMOJI;
        break;
      case '3':
        Model = EMOTIONCONTENT;
        break;
      case '4':
        Model = DEVICE;
        break;
      case '5':
        Model = CONTENT;
        break;
      case '6':
        Model = HOTENESSCATEGORY;
        break;
      case '7':
        Model = HOTENESSCARBG;
        break;
      case '8':
        Model = FRIENDCARBG;
        break;
      case '9':
        Model = TEMP;
      case '10':
        Model = COLLAB;
        break;
      case '11':
        Model = BLUFFCARBG;
        break;
      case '12':
        Model = CHALLENGECONTENT;
        break;
      default:
        throw new Error('Invalid TypeId');
    }

    if (TypeId === '6') {

      // 🔹 1. Find HOTENESSCATEGORY items first
      const hotnessCategories = await HOTENESSCATEGORY.find(
        { _id: { $in: ids } },
        { categoryTitle: 1 }
      ).lean();

      // 🔹 2. Delete from HOTENESSCATEGORY
      await HOTENESSCATEGORY.deleteMany({ _id: { $in: ids } });

      // 🔹 3. For each categoryTitle, delete SAME COUNT from MAINCATEGORY
      for (const item of hotnessCategories) {

        // Find ONE matching MAINCATEGORY record
        const mainCategory = await MAINCATEGORY.findOne({
          categoryTitle: item.categoryTitle
        });

        if (mainCategory) {
          await MAINCATEGORY.deleteOne({ _id: mainCategory._id });
        }
      }
    } else {
      await Model.deleteMany({ _id: { $in: ids } });
    }

    res.status(200).json({
      status: 1,
      message: 'Data Deleted Successfully',
    });

  } catch (error) {
    res.status(400).json({
      status: 0,
      message: error.message,
    });
  }
};
