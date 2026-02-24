const MOREAPP = require('../models2/moreApp');

async function fetchPlayStoreIcon(packageName) {
    try {
        const gplay = await import('google-play-scraper');
        const appInfo = await gplay.default.app({ appId: packageName });
        return appInfo.icon;
    } catch (error) {
        console.error('Error fetching app info:', error);
        throw error;
    }
}


exports.Create = async function (req, res, next) {
    try {

        const downloadCount = await fetchPlayStoreIcon(req.body.packageName);
        req.body.logo = downloadCount

        const dataCreate = await MOREAPP.create(req.body);

        res.status(201).json({
            status: 1,
            message: 'APP Created Successfully',
            data: dataCreate,
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};


exports.Found = async function (req, res, next) {
    try {
        const { packageName, language } = req.body;

        const hasWhitespaceInKey = obj => {
            return Object.keys(obj).some(key => /\s/.test(key));
        };

        if (hasWhitespaceInKey(req.body)) {
            throw new Error('Field names must not contain whitespace.');
        }

        if (!packageName || !language ) {
            throw new Error('Enter all fields : language , packageName');
        }

        let queryCondition;
        if (await MOREAPP.exists({ packageName })) {
            queryCondition = { packageName: { $ne: packageName } };
        } else if (await MOREAPP.exists({ appId: packageName })) {
            queryCondition = { appId: { $ne: packageName } };
        } else {
            throw new Error('No matching packageName or appId found');
        }

        const languageFieldMap = {
            hi: 'hiAppName',
            es: 'esAppName',
            ur: 'urAppName',
            fr: 'frAppName',
            pt: 'ptAppName',
            in: 'inAppName',
            ar: 'arAppName',
            default: 'enAppName'
        };

        const selectedField = languageFieldMap[req.body.language] || languageFieldMap.default;

        const moreAppData = await MOREAPP.find(queryCondition).select(`${selectedField} logo appId packageName -_id`);

        const formattedAppData = moreAppData.map(app => ({
            appName: app[selectedField],
            logo: app.logo,
            appId: app.appId,
            packageName: app.packageName
        }));

        if (formattedAppData.length === 0) {
            throw new Error("No App Found");
        }
        
        res.status(200).json({
            status: 1,
            message: 'Data Found Successfully',
            data: formattedAppData,
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

        const moreAppData = await MOREAPP.find();

        res.status(200).json({
            status: 1,
            message: 'Data Found Successfully',
            data: moreAppData,
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
        if (req.body.packageName) {
            const downloadCount = await fetchPlayStoreIcon(req.body.packageName);
            req.body.logo = downloadCount
        }

        const dataUpdate = await MOREAPP.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.status(200).json({
            status: 1,
            message: 'App Updated Successfully',
            data: dataUpdate,
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
        await MOREAPP.findByIdAndDelete(req.params.id);
        res.status(204).json({
            status: 1,
            message: 'App Deleted Successfully',
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message,
        });
    }
};
