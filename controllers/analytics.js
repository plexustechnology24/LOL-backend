
const DEEPLINK = require('../models/deeplink');
const DEEPLINKANALYTICS = require('../models/deeplinkanalytics');
const WEB = require('../models/web');
const DEVICE = require('../models/device');
const NUSER = require('../models2/usernew');
const crypto = require('crypto');
const { Worker, isMainThread, parentPort } = require('worker_threads');

const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const analyticsDataClient = new BetaAnalyticsDataClient({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
});

exports.Web = async (req, res) => {
    try {
        const { since, until, pageLocation } = req.body;

        if (!pageLocation) {
            return res.status(400).json({
                status: 0,
                message: 'pageLocation is required'
            });
        }

        // Extract only pathname from URL
        let filterValue = pageLocation;

        try {
            const parsed = new URL(pageLocation);
            filterValue = parsed.pathname;  // only "/card/123"
        } catch (e) {
            // If not full URL, assume it's already a path
            filterValue = pageLocation;
        }

        console.log("Filtering by pagePath:", filterValue);

        const [response] = await analyticsDataClient.runReport({
            property: `properties/453486016`,
            dateRanges: [
                {
                    startDate: since || '2024-01-01',
                    endDate: until || 'today'
                }
            ],
            dimensions: [
                { name: 'pagePath' },
                { name: 'eventName' }
            ],
            metrics: [
                { name: 'eventCount' }
            ],
            dimensionFilter: {
                andGroup: {
                    expressions: [
                        {
                            filter: {
                                fieldName: 'pagePath',
                                stringFilter: {
                                    matchType: 'CONTAINS',
                                    value: filterValue
                                }
                            }
                        },
                        {
                            orGroup: {
                                expressions: [
                                    'link_view',
                                    'send_card',
                                    'resend_card',
                                    'web_redirect'
                                ].map(event => ({
                                    filter: {
                                        fieldName: 'eventName',
                                        stringFilter: {
                                            matchType: 'EXACT',
                                            value: event
                                        }
                                    }
                                }))
                            }
                        }
                    ]
                }
            }
        });

        let views = 0,
            sendcards = 0,
            resendcards = 0,
            webredirects = 0;

        if (response.rows) {
            // console.log("GA4 Raw Rows:", JSON.stringify(response.rows, null, 2));

            response.rows.forEach(row => {
                const eventName = row.dimensionValues[1].value;
                const totalCount = parseInt(row.metricValues[0].value);

                if (eventName === 'link_view') views += totalCount;
                else if (eventName === 'send_card') sendcards += totalCount;
                else if (eventName === 'resend_card') resendcards += totalCount;
                else if (eventName === 'web_redirect') webredirects += totalCount;
            });
        }

        // console.log("FINAL RESPONSE => ", {
        //     status: 1,
        //     views,
        //     sendcards,
        //     resendcards,
        //     webredirects
        // });

        return res.status(200).json({
            status: 1,
            message: 'Data fetched successfully',
            views,
            sendcards,
            resendcards,
            webredirects
        });
    } catch (error) {
        console.error('Error running event report:', error);
        return res.status(400).json({
            status: 0,
            message: error.message,
            views: 0,
            sendcards: 0,
            resendcards: 0,
            webredirects: 0
        });
    }
};



exports.Demo = async (req, res) => {
    try {
        // Fetch the URL list from the WEB collection
        const urlList = await WEB.find();

        // Iterate over the URL list and call findPrankData2 for each item
        const finalResult = await Promise.all(urlList.map(async (item) => {

            return {
                url: item.ShareURL || "",
                category: item.category || "",
                name: item.name || "",
                username: item.username || "",
                society: item.society || "",
                collage: item.collage || "",
                city: item.city || "",
                state: item.state || "",
                country: item.country || "",
                install: item.install || "",
                views: "",
                sendcards: "",
                resendcards: "",
                webredirects: "",
                _id: item._id,
                Date: item.createdAt
            };
        }));

        // Return the final response with the fetched data
        return res.status(200).json({
            status: 1,
            message: 'Data fetched successfully',
            data: finalResult
        });

    } catch (error) {
        console.error('Error running event report:', error);
        return res.status(400).json({
            status: 0,
            message: error.message
        });
    }
};


exports.WebCreate = async (req, res) => {
    try {
        if (req.body.ShareURL) {
            if (!req.body.ShareURL.startsWith('https://lolcards.link/')) {
                return res.status(400).json({
                    status: 0,
                    message: 'Please enter a valid URL.',
                });
            }

            // Split URL
            const parts = req.body.ShareURL.replace('https://lolcards.link/', '').split('/');

            // username = parts[0]
            // category (encoded) = parts[1]
            if (!parts[1]) {
                return res.status(400).json({
                    status: 0,
                    message: 'Category is missing in URL.',
                });
            }

            // Decode category from Base64
            let category;
            try {
                category = Buffer.from(parts[1], 'base64').toString('utf-8');
            } catch (decodeErr) {
                return res.status(400).json({
                    status: 0,
                    message: 'Invalid category encoding.',
                });
            }

            // Add decoded category to body
            req.body.category = category;

            // =============================================
            const nuserLink = `lolcards.link/${parts[0]}`;
            const categorycheck = parts[1];
            const user = await NUSER.findOne({
                link: nuserLink,
                question: {
                    $elemMatch: {
                        category: categorycheck
                    }
                }
            });

            if (!user) {
                return res.status(400).json({
                    status: 0,
                    message: 'Invalid link.'
                });
            }

            // =====================================================


            let uniqueId;
            let existingLink;

            // Ensure unique ID is generated
            do {
                uniqueId = crypto.createHash('sha256').update(req.body.ShareURL + Date.now() + Math.random()).digest('hex').substring(0, 10);
                existingLink = await WEB.findOne({ sourceid: uniqueId });
            } while (existingLink);
            req.body.sourceid = uniqueId;

            // Check duplicate URL
            const existingUrl = await WEB.findOne({ ShareURL: req.body.ShareURL });
            if (existingUrl) {
                return res.status(400).json({
                    status: 0,
                    message: 'URL already exists',
                });
            }

            const newUrl = await WEB.create(req.body);

            // Schedule deletion after 10 days (864000000 ms)
            setTimeout(async () => {
                try {
                    await WEB.findByIdAndDelete(newUrl._id);
                    console.log(`URL with ID ${newUrl._id} deleted after 10 days.`);
                } catch (deleteError) {
                    console.error('Error deleting URL:', deleteError);
                }
            }, 864000000);

            return res.status(200).json({
                status: 1,
                message: 'URL created successfully',
                category: category
            });
        }
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};

exports.WebUpdate = async (req, res) => {
    try {
        if (req.body.ShareURL) {
            if (!req.body.ShareURL.startsWith('https://lolcards.link/')) {
                return res.status(400).json({
                    status: 0,
                    message: 'Please enter a valid URL.',
                });
            }

            // Split URL
            const parts = req.body.ShareURL.replace('https://lolcards.link/', '').split('/');

            // username = parts[0]
            // category (encoded) = parts[1]
            if (!parts[1]) {
                return res.status(400).json({
                    status: 0,
                    message: 'Category is missing in URL.',
                });
            }

            // Decode category from Base64
            let category;
            try {
                category = Buffer.from(parts[1], 'base64').toString('utf-8');
            } catch (decodeErr) {
                return res.status(400).json({
                    status: 0,
                    message: 'Invalid category encoding.',
                });
            }

            // Add decoded category to body
            req.body.category = category;

            // Check duplicate URL
            const existingUrl = await WEB.findOne({
                ShareURL: req.body.ShareURL,
                _id: { $ne: req.params.id } // 👈 current record ignore
            });
            if (existingUrl) {
                return res.status(400).json({
                    status: 0,
                    message: 'URL already exists',
                });
            }

            // =============================================
            const nuserLink = `lolcards.link/${parts[0]}`;
            const categorycheck = parts[1];
            const user = await NUSER.findOne({
                link: nuserLink,
                question: {
                    $elemMatch: {
                        category: categorycheck
                    }
                }
            });

            if (!user) {
                return res.status(400).json({
                    status: 0,
                    message: 'Invalid link.'
                });
            }

            // =====================================================

            const newUrl = await WEB.findByIdAndUpdate(
                req.params.id,
                req.body,
                { new: true, runValidators: true }
            );


            return res.status(200).json({
                status: 1,
                message: 'URL updated successfully',
                category: category
            });
        }
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};


exports.DeleteWeb = async function (req, res, next) {
    try {
        await WEB.findByIdAndDelete(req.params.id);

        res.status(204).json({
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

// ===================== Video collab ==========================

exports.DeepLink = async (req, res) => {
    try {
        const { since, until } = req.body;
        if (!since || !until) {
            throw new Error("Both 'since' and 'until' dates are required.");
        }

        // Fetch all sources from DEEPLINK
        const deeplinkSources = await DEEPLINK.find().select('source');

        // Build match conditions (excluding platform)
        let matchConditions = {
            date: { $gte: since, $lte: until }
        };

        // Fetch analytics data grouped by source and platform
        const analyticsData = await DEEPLINKANALYTICS.aggregate([
            { $match: matchConditions },
            {
                $group: {
                    _id: { sourceid: "$sourceid", platform: "$platform" },
                    view: { $sum: "$view" },
                    install: { $sum: "$install" }
                }
            },
            {
                $project: {
                    _id: 0,
                    sourceid: "$_id.sourceid",
                    platform: "$_id.platform",
                    view: 1,
                    install: 1
                }
            }
        ]);

        // Convert DEEPLINK sources to a Set for quick lookup
        const sourceSet = new Set(deeplinkSources.map(link => link.source));

        // Convert analytics data to a structured map with Android & iOS stats
        const analyticsMap = new Map();
        analyticsData.forEach(item => {
            if (!analyticsMap.has(item.sourceid)) {
                analyticsMap.set(item.sourceid, {
                    androidView: 0, androidInstall: 0,
                    iosView: 0, iosInstall: 0
                });
            }
            if (item.platform === "android") {
                analyticsMap.get(item.sourceid).androidView = item.view;
                analyticsMap.get(item.sourceid).androidInstall = item.install;
            } else if (item.platform === "ios") {
                analyticsMap.get(item.sourceid).iosView = item.view;
                analyticsMap.get(item.sourceid).iosInstall = item.install;
            }
        });

        // Construct the final response ensuring all sources from DEEPLINK are included
        let responseData = deeplinkSources.map(link => ({
            sourceid: link.source,
            androidView: analyticsMap.get(link.source)?.androidView || 0,
            androidInstall: analyticsMap.get(link.source)?.androidInstall || 0,
            iosView: analyticsMap.get(link.source)?.iosView || 0,
            iosInstall: analyticsMap.get(link.source)?.iosInstall || 0,
            delete: false // Since it's present in DEEPLINK, delete should be false
        }));

        // Ensure "organic" sourceid is included in responseData
        if (!responseData.find(item => item.sourceid === "organic")) {
            responseData.push({
                sourceid: "organic",
                androidView: analyticsMap.get("organic")?.androidView || 0,
                androidInstall: analyticsMap.get("organic")?.androidInstall || 0,
                iosView: analyticsMap.get("organic")?.iosView || 0,
                iosInstall: analyticsMap.get("organic")?.iosInstall || 0,
                delete: false
            });
        }

        // Add any source IDs from analytics that do not exist in DEEPLINK
        analyticsData.forEach(item => {
            if (item.sourceid !== "organic" && !sourceSet.has(item.sourceid)) {
                responseData.push({
                    sourceid: item.sourceid,
                    androidView: analyticsMap.get(item.sourceid)?.androidView || 0,
                    androidInstall: analyticsMap.get(item.sourceid)?.androidInstall || 0,
                    iosView: analyticsMap.get(item.sourceid)?.iosView || 0,
                    iosInstall: analyticsMap.get(item.sourceid)?.iosInstall || 0,
                    delete: true // Mark as deleted since it's missing in DEEPLINK
                });
            }
        });

        responseData.sort((a, b) => (a.sourceid === "organic" ? -1 : b.sourceid === "organic" ? 1 : 0));

        console.log(responseData);


        return res.status(200).json({
            status: 1,
            message: 'Data fetched successfully',
            data: responseData
        });

    } catch (error) {
        return res.status(500).json({
            status: 0,
            message: error.message
        });
    }
};


// ====================== deeplink ========================

exports.DeepLinkCreate = async (req, res) => {
    try {
        const { source } = req.body;
        if (!source) {
            throw new Error("Source is required");
        }

        const existingSource = await DEEPLINK.findOne({ source });
        if (existingSource) {
            return res.status(400).json({
                status: 0,
                message: "Source already exists",
            });
        }

        let uniqueId;
        let existingLink;

        // Ensure unique ID is generated
        do {
            uniqueId = crypto.createHash('sha256').update(source + Date.now() + Math.random()).digest('hex').substring(0, 10);
            existingLink = await DEEPLINK.findOne({ sourceid: uniqueId });
        } while (existingLink);

        // Store the new unique link
        req.body.link = `https://api.lolcards.link/api/download?source=${uniqueId}`;
        req.body.sourceid = uniqueId;
        const data = await DEEPLINK.create(req.body);

        res.status(201).json({
            status: 1,
            message: 'Deep Link Created Successfully',
            data,
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};

exports.DeepLinkRead = async function (req, res, next) {
    try {
        const data = await DEEPLINK.find().lean();

        res.status(200).json({
            status: 1,
            message: 'Data Found Successfully',
            data: data,
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};

exports.DeepLinkUpdate = async function (req, res, next) {
    try {
        const update = await DEEPLINK.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.status(200).json({
            status: 1,
            message: 'Data Updated Successfully',
            data: update,
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};

exports.DeepLinkDelete = async function (req, res, next) {
    try {
        await DEEPLINK.findByIdAndDelete(req.params.id);
        res.status(204).json({
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

exports.Install = async function (req, res, next) {
    try {
        const today = new Date().toISOString().split('T')[0];
        const sourceId = req.query.source;
        const id = parseInt(req.query.platformid, 10); // Convert to number
        const deviceId = req.query.deviceId;  // <-- NEW

        // if (!deviceId || deviceId.trim() === "") {
        //     throw new Error("deviceId is required")
        // }

        if (deviceId) {
            const deviceExists = await DEVICE.findOne({ deviceId: deviceId });
            console.log(deviceExists);

            if (deviceExists) {
                return res.status(200).json({
                    status: 1,
                    message: "Device registered. Install not counted."
                });
            }
        }

        let platform = "";

        if (id === 1) {
            platform = "android";
        } else if (id === 2) {
            platform = "ios";
        } else {
            throw new Error("Invalid platformid. Only 1 (android) or 2 (ios) are allowed.");
        }

        if (sourceId) {
            const sourceExists = await DEEPLINK.findOne({ sourceid: sourceId });

            if (sourceExists) {
                await DEEPLINKANALYTICS.findOneAndUpdate(
                    { date: today, sourceid: sourceExists.source, platform: platform },
                    { $inc: { install: 1 } },
                    { upsert: true, new: true }
                );
            } else if (sourceId === "organic") {
                await DEEPLINKANALYTICS.findOneAndUpdate(
                    { date: today, sourceid: "organic", platform: platform },
                    { $inc: { install: 1 } },
                    { upsert: true, new: true }
                );
            } else {
                await WEB.findOneAndUpdate(
                    { sourceid: sourceId },
                    { $inc: { install: 1 } },
                    { upsert: true, new: true }
                );
            }
        }
        else {
            throw new Error("source is required");
        }

        return res.status(201).json({
            status: 1,
            message: "install event successfully track",
        });

    } catch (error) {
        return res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};

function isPreviewBot(userAgent = '') {
    return /WhatsApp|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Discordbot|Slackbot/i.test(userAgent);
}

exports.Download = async function (req, res) {
    try {
        const userAgent = req.headers['user-agent'] || '';
        const today = new Date().toISOString().split('T')[0];
        const sourceId = req.query.source;

        const isIOS = /iphone|ipad|ipod/i.test(userAgent);
        const isSafari = /safari/i.test(userAgent) && !/chrome|crios|fxios/i.test(userAgent);
        const isAndroid = /android/i.test(userAgent);

        // Define store URLs
        let playStoreURL = 'https://play.google.com/store/apps/details?id=com.lol.android';
        let appStoreURL = 'https://apps.apple.com/us/app/lol-anonymous-game/id6670788272';

        // Append sourceId params if exists
        if (sourceId) {
            playStoreURL += `&referrer=source=${encodeURIComponent(sourceId)}`;
            appStoreURL += `?mt=${encodeURIComponent(sourceId)}`;
        }

        // Check if request is from a preview bot
        const isBot = isPreviewBot(userAgent);

        // Increment view count only for real users
        if (!isBot && sourceId) {
            const platform = isIOS || isSafari ? 'ios' : 'android';
            const sourceExists = await DEEPLINK.findOne({ sourceid: sourceId });

            if (sourceExists) {
                await DEEPLINKANALYTICS.findOneAndUpdate(
                    { date: today, sourceid: sourceExists.source, platform },
                    { $inc: { view: 1 } },
                    { upsert: true, new: true }
                );
            }
        }

        // Redirect user to proper store
        if (isIOS || isSafari) {
            return res.redirect(appStoreURL);
        } else {
            return res.redirect(playStoreURL);
        }

    } catch (error) {
        return res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};

