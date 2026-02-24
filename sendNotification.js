const axios = require('axios');
const mongoose = require('mongoose');
require('dotenv').config();

console.log("🚀 Enhanced Country-Based Notification System Starting...");

// MongoDB URI
const mongoUri = "mongodb+srv://loladmin:sPuNLyNN43P9kvJJ@lol.xtafe5q.mongodb.net/LOL";

// Connect to MongoDB
mongoose.connect(mongoUri)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.log('❌ Failed to connect to MongoDB', err));

// Define Notification schema
const Schema = mongoose.Schema;
const autoNotificationData = new Schema({
  Title: String,
  Description: String,
  hiDescription: String,
  esDescription: String
}, {
  versionKey: false,
  timestamps: true
});

const NOTIFICATION = mongoose.models['auto-notification'] || mongoose.model('auto-notification', autoNotificationData);

let isNotificationSending = false;

// Define target countries with their country codes and timezones
const TARGET_COUNTRIES = {
  'IN': { name: 'India', timezone: 'Asia/Kolkata' },
  'US': { name: 'United States', timezone: 'America/New_York' },
  'GB': { name: 'United Kingdom', timezone: 'Europe/London' },
  'CA': { name: 'Canada', timezone: 'America/Toronto' },
  'AU': { name: 'Australia', timezone: 'Australia/Sydney' }
};

// Get parameters from CLI args
const args = process.argv;
const targetCountry = args[2] || "DEFAULT"; // Can be country code or "DEFAULT"
const timezone = args.find(arg => arg.startsWith('--timezone='))?.split('=')[1];

console.log("🌍 Target:", targetCountry === "DEFAULT" ? "All other countries" : targetCountry);
if (timezone) console.log("⏰ Timezone:", timezone);

const sendPushNotification = async (Title, Description, hiDescription, esDescription, countryFilter = "DEFAULT") => {
  const appId = '69c53fa2-c84d-42a9-b377-1e4fff31fa18';
  const apiKey = 'os_v2_app_nhct7iwijvbktm3xdzh76mp2da2jpkl4r2vuegu4sgn2tu363nbtac3vwdhnnhm7ogdvxbg7zi2d7tn5v6xwix7gyh6pga5bufr244a';

  const url = 'https://onesignal.com/api/v1/notifications';

  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    Authorization: `Basic ${apiKey}`,
  };

  let filters;

  if (countryFilter === "DEFAULT") {
    // Send to all countries EXCEPT the 5 specific ones
    const excludeCountries = Object.keys(TARGET_COUNTRIES);
    filters = excludeCountries.map(country => ({
      "field": "country",
      "relation": "!=",
      "value": country
    }));
    
    // Connect filters with AND operator (all conditions must be true)
    const finalFilters = [];
    for (let i = 0; i < filters.length; i++) {
      finalFilters.push(filters[i]);
      if (i < filters.length - 1) {
        finalFilters.push({"operator": "AND"});
      }
    }
    filters = finalFilters;
  } else {
    // Send to specific country
    filters = [
      {
        "field": "country",
        "relation": "=",
        "value": countryFilter
      }
    ];
  }

  const data = {
    app_id: appId,
    filters: filters,
    contents: {
      en: Description,
      hi: hiDescription || Description,
      es: esDescription || Description
    },
    headings: {
      en: Title
    },
    data: {
      target: countryFilter,
      notification_type: countryFilter === "DEFAULT" ? 'default_countries' : 'specific_country',
      timestamp: new Date().toISOString(),
      timezone: timezone || 'UTC'
    }
  };

  try {
    const response = await axios.post(url, data, { headers });
    const targetName = countryFilter === "DEFAULT" ? "other countries" : (TARGET_COUNTRIES[countryFilter]?.name || countryFilter);
    console.log(`✅ Notification sent to ${targetName}:`, {
      recipients: response.data.recipients || 0,
      notification_id: response.data.id
    });
    return response.data;
  } catch (error) {
    console.error(`❌ Error sending notification:`, error.response?.data || error.message);
    throw error;
  }
};

const sendRandomNotification = async (countryFilter = "DEFAULT") => {
  if (isNotificationSending) {
    console.log('⏳ Notification sending already in progress. Skipping...');
    return;
  }

  isNotificationSending = true;

  try {
    const notifications = await NOTIFICATION.find();
    if (notifications.length === 0) {
      console.log('📭 No notifications available in database');
      return;
    }

    const randomIndex = Math.floor(Math.random() * notifications.length);
    const { Title, Description, hiDescription, esDescription } = notifications[randomIndex];

    const targetName = countryFilter === "DEFAULT" ? "other countries" : (TARGET_COUNTRIES[countryFilter]?.name || countryFilter);
    console.log(`🔔 Sending notification to ${targetName}:`);
    console.log(`   Title: ${Title}`);
    console.log(`   Description: ${Description}`);

    const result = await sendPushNotification(Title, Description, hiDescription, esDescription, countryFilter);
    
    return result;

  } catch (error) {
    console.error('❌ Error in notification process:', error);
  } finally {
    isNotificationSending = false;
  }
};

// Main execution
const main = async () => {
  try {
    const targetName = targetCountry === "DEFAULT" ? "all other countries (excluding IN, US, GB, CA, AU)" : (TARGET_COUNTRIES[targetCountry]?.name || targetCountry);
    console.log(`🎯 Targeting users in: ${targetName}`);
    
    const result = await sendRandomNotification(targetCountry);
    
    if (result && result.recipients) {
      console.log(`\n✅ SUCCESS! Notification sent to ${result.recipients} users`);
    } else {
      console.log(`\n⚠️  Notification sent but recipient count unknown`);
    }

  } catch (error) {
    console.error('❌ Main process error:', error);
  } finally {
    console.log('\n🏁 Process completed');
    process.exit(0);
  }
};

// Run the script
main();