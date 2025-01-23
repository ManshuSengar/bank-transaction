const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const axios = require('axios');
const crypto = require('crypto');
const numWorkers = 10; // Each worker will handle 5 transactions

if (isMainThread) {
  async function runWorkers() {
    const workers = [];
    for (let i = 0; i < numWorkers; i++) {
      const worker = new Worker(__filename, {
        workerData: { workerId: i }
      });
      workers.push(worker);
    }

    workers.forEach(worker => {
      worker.on('message', result => {
        console.log(`Worker completed: ${result.success} transactions`);
      });
      worker.on('error', error => {
        console.error('Worker error:', error);
      });
    });
  }

  runWorkers();
} else {
  async function processTransactions() {
    const baseUrl = 'https://merchant.fonexpay.com';
    const username = 'DEMOFONEXPAY';
    const token = 'a48ab3b5cefb70b4aced3de3d90b94fa750121cccd04093bc2dcb6f90b1e99aa';
    let successCount = 0;

    async function makeTransaction() {
      try {
        // Generate unique ID
        const uniqueId = crypto.randomBytes(8).toString('hex');
        
        // Step 1: Encrypt data
        const encryptResponse = await axios.post(`${baseUrl}/validate/encrypt`, {
          data: {
            uniqueid: uniqueId,
            amount: "105"
          }
        });


        console.log("encryptResponse--> ",encryptResponse);
        if (encryptResponse.data.messageCode === 'ENCRYPTION_SUCCESS') {
          // Step 2: Process payment
          const paymentResponse = await axios.post(`${baseUrl}/payin/qr`, {
            data: encryptResponse.data.encryptedData,
            token: token,
            username: username
          });
          console.log("paymentResponse--> ",paymentResponse);
          if (paymentResponse.data) {
            successCount++;
          }
        }
      } catch (error) {
        console.log(error);
      }
    }

    // Process 5 transactions per worker
    setInterval(async ()=>{
    const promises = Array(5).fill().map(() => makeTransaction());
    await Promise.all(promises);
    },500)
   
    
    parentPort.postMessage({ success: successCount });
  }

  processTransactions();
}