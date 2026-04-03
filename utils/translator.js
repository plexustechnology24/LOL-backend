const axios = require('axios');
const { transliterate } = require("transliteration");

// Convert text to Hinglish
function convertToHinglish(text) {
    const emojiRegex = /([\u231A-\uD83E\uDDFF\uD83C-\uDBFF\uDC00-\uDFFF]+)/g;

    const emojis = text.match(emojiRegex) || [];

    const textWithoutEmoji = text.replace(emojiRegex, '');

    const hinglishText = transliterate(textWithoutEmoji);

    return hinglishText.trim() + " " + emojis.join(" ");
}

// Translate text
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
        return text;
    }
}

// Export functions
module.exports = {
    convertToHinglish,
    translateText
};