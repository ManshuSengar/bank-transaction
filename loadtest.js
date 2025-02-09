const axios = require("axios");
const { performance } = require("perf_hooks");

const API_URL = "https://fake-json-api.mock.beeceptor.com/users";
const TOTAL_REQUESTS = 10000; // Number of requests to send
const CONCURRENCY = 1000; // Number of concurrent requests

async function sendRequest() {
  try {
    const startTime = performance.now();
    const response = await axios.get(API_URL);
    const endTime = performance.now();
    console.log(
      `Success: ${response.status} - Time: ${(endTime - startTime).toFixed(
        2
      )/1000} ms`
    );
  } catch (error) {
    console.error(
      `Error: ${error.response ? error.response.status : error.message}`
    );
  }
}

async function loadTest() {
  let requests = [];
  for (let i = 0; i < TOTAL_REQUESTS; i++) {
    requests.push(sendRequest());
    if (requests.length >= CONCURRENCY) {
      await Promise.all(requests);
      requests = [];
    }
  }
  // Ensure remaining requests complete
  if (requests.length > 0) {
    await Promise.all(requests);
  }
  console.log("Load test completed");
}

loadTest();
