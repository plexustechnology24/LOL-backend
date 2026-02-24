const axios = require('axios');

const REQUESTS_PER_SECOND = 80;
const TEST_DURATION_SECONDS = 15; // 5 minutes
const URL = 'https://api.lolcards.link/api/idcheck';

let totalRequestsSent = 0;
let totalErrors = 0;

async function sendRequest() {
  try {
    await axios.post(
      URL,
      new URLSearchParams({
        id: Math.floor(Math.random() * 1000000)
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 5000
      }
    );
  } catch (err) {
    totalErrors++;
  }
}

async function runLoadTest() {
  console.log("Starting Load Test...");
  console.time("TotalTestTime");

  const interval = setInterval(async () => {
    const promises = [];

    for (let i = 0; i < REQUESTS_PER_SECOND; i++) {
      promises.push(sendRequest());
      totalRequestsSent++;
    }

    await Promise.all(promises);

  }, 1000);

  setTimeout(() => {
    clearInterval(interval);
    console.timeEnd("TotalTestTime");

    console.log("Test Completed");
    console.log("Total Requests Sent:", totalRequestsSent);
    console.log("Total Errors:", totalErrors);
  }, TEST_DURATION_SECONDS * 1000);
}

runLoadTest();