const axios = require('axios');
const crypto = require('crypto');

const BASE_URL = 'http://localhost:5001';
const TOTAL_REQUESTS = 50;

async function generateUniqueId() {
  return crypto.randomBytes(5).toString('hex');
}

async function makeEncryptionRequest(uniqueId) {
  try {
    const response = await axios.post(`${BASE_URL}/validate/encrypt`, {
      data: {
        uniqueid: uniqueId,
        amount: "101"
      }
    });
    return response.data.encryptedData;
  } catch (error) {
    console.error(`Encryption failed for ${uniqueId}:`, error.message);
    throw error;
  }
}

async function makePayinRequest(encryptedData) {
  try {
    const response = await axios.post(`${BASE_URL}/payin/qr`, {
      data: encryptedData,
      token: "a48ab3b5cefb70b4aced3de3d90b94fa750121cccd04093bc2dcb6f90b1e99aa",
      username: "DEMOFONEXPAY"
    });
    return response.data;
  } catch (error) {
    console.error('Payin request failed:', error.message);
    throw error;
  }
}

async function processRequest() {
  try {
    const uniqueId = await generateUniqueId();
    const encryptedData = await makeEncryptionRequest(uniqueId);
    const payinResult = await makePayinRequest(encryptedData);
    return { uniqueId, success: true, result: payinResult };
  } catch (error) {
    return { uniqueId, success: false, error: error.message };
  }
}

async function makeParallelRequests() {
  console.time('Total Execution Time');
  const requests = Array(TOTAL_REQUESTS).fill().map(() => processRequest());
  
  const results = await Promise.allSettled(requests);
  
  const summary = {
    successful: results.filter(r => r.value?.success).length,
    failed: results.filter(r => !r.value?.success).length
  };
  
  console.timeEnd('Total Execution Time');
  console.log('Summary:', summary);
  
  return results;
}

// Run the script
makeParallelRequests().catch(console.error);