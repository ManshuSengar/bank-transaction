const axios = require('axios');
const fs = require('fs/promises');
const path = require('path');

class APITester {
  constructor(config) {
    this.config = config;
    this.results = [];
    this.startTime = null;
  }

  generateRandomData() {
    return {
      data: {
        uniqueid: Math.floor(10000 + Math.random() * 90000).toString(),
        amount: '102'
      }
    };
  }

  async makeEncryptionRequest(data) {
    try {
      const encryptResponse = await axios.request({
        method: 'post',
        url: 'https://merchant.Fonexpay.com/validate/encrypt',
        headers: this.config.headers,
        data
      });

    
      console.log(encryptResponse);
      return encryptResponse.data.encryptedData;
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  async makePayinRequest(encryptedData) {
    try {
      const payinResponse = await axios.request({
        method: 'post',
        url: 'https://merchant.Fonexpay.com/payin/qr',
        headers: this.config.headers,
        data: {
          data: encryptedData,
          token: this.config.token,
          username: this.config.username
        }
      });

      return payinResponse.data;
    } catch (error) {
      throw new Error(`Payin request failed: ${error.message}`);
    }
  }

  async makeRequest() {
    try {
      const randomData = this.generateRandomData();
      
      const encryptedData = await this.makeEncryptionRequest(randomData);
      const payinResponse = await this.makePayinRequest(encryptedData);

      return {
        success: true,
        data: payinResponse,
        originalData: randomData,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  async runBulkTest(totalRequests, concurrency) {
    this.startTime = Date.now();
    const batches = Math.ceil(totalRequests / concurrency);
    
    for (let i = 0; i < batches; i++) {
      const batchSize = Math.min(concurrency, totalRequests - (i * concurrency));
      const promises = Array(batchSize).fill().map(() => this.makeRequest());
      const batchResults = await Promise.all(promises);
      this.results.push(...batchResults);
      
      console.log(`Completed ${this.results.length}/${totalRequests} requests`);
    }

    await this.generateReport();
  }

  async generateReport() {
    const endTime = Date.now();
    const duration = (endTime - this.startTime) / 1000;
    
    const summary = {
      totalRequests: this.results.length,
      successfulRequests: this.results.filter(r => r.success).length,
      failedRequests: this.results.filter(r => !r.success).length,
      durationSeconds: duration,
      requestsPerSecond: this.results.length / duration,
      errors: this.results.filter(r => !r.success).map(r => r.error)
    };

    const reportPath = path.join(__dirname, `api_test_report_${Date.now()}.json`);
    await fs.writeFile(reportPath, JSON.stringify({summary, results: this.results}, null, 2));
    console.log(`Test completed. Report saved to ${reportPath}`);
    console.log('Summary:', summary);
  }
}

// Usage
const config = {
  headers: {
    "Content-Type": "application/json",
    "x-auth-token": "your_jwt_token_here",
  },
  token: "a48ab3b5cefb70b4aced3de3d90b94fa750121cccd04093bc2dcb6f90b1e99aa",
  username: "DEMOFONEXPAY",
};

const tester = new APITester(config);
tester.runBulkTest(100, 10)
  .catch(console.error);