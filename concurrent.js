// main.js
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path');

// Configuration
const CONFIG = {
    CONCURRENT_CALLS: 25,
    WORKERS_COUNT: 4  // Number of workers to distribute the load
};

if (isMainThread) {
    // This code runs in the main thread
    
    const startWorkers = async () => {
        console.time('Total Execution Time');
        console.log(`Starting ${CONFIG.CONCURRENT_CALLS} API calls distributed across ${CONFIG.WORKERS_COUNT} workers...`);

        // Calculate calls per worker
        const callsPerWorker = Math.ceil(CONFIG.CONCURRENT_CALLS / CONFIG.WORKERS_COUNT);
        const results = [];
        const workers = [];

        // Create a promise to handle all workers
        const workerPromises = Array.from({ length: CONFIG.WORKERS_COUNT }, (_, workerIndex) => {
            return new Promise((resolve, reject) => {
                // Calculate start and end indices for this worker
                const startIndex = workerIndex * callsPerWorker;
                const endIndex = Math.min(startIndex + callsPerWorker, CONFIG.CONCURRENT_CALLS);
                const callCount = endIndex - startIndex;

                if (callCount <= 0) return resolve([]); // Skip if no calls assigned

                const worker = new Worker(__filename, {
                    workerData: {
                        startIndex,
                        callCount,
                        workerIndex
                    }
                });

                workers.push(worker);

                worker.on('message', (data) => {
                    results.push(...data);
                });

                worker.on('error', reject);
                worker.on('exit', (code) => {
                    if (code !== 0) {
                        reject(new Error(`Worker ${workerIndex} stopped with exit code ${code}`));
                    } else {
                        resolve();
                    }
                });
            });
        });

        try {
            // Wait for all workers to complete
            await Promise.all(workerPromises);
            console.timeEnd('Total Execution Time');

            // Analyze results
            const successful = results.filter(r => r.success);
            const failed = results.filter(r => !r.success);

            console.log('\nResults Summary:');
            console.log(`Total Requests: ${results.length}`);
            console.log(`Successful: ${successful.length}`);
            console.log(`Failed: ${failed.length}`);

            if (failed.length > 0) {
                console.log('\nFailed Requests:');
                failed.forEach(f => {
                    console.log(`Request ${f.index} failed:`, f.error);
                });
            }

        } catch (error) {
            console.error('Error in workers:', error);
            process.exit(1);
        }

        // Cleanup workers
        workers.forEach(worker => worker.terminate());
    };

    // Start the workers
    startWorkers()
        .then(() => {
            console.log('\nExecution completed');
            process.exit(0);
        })
        .catch(error => {
            console.error('Script failed:', error);
            process.exit(1);
        });

} else {
    // This code runs in worker threads
    const axios = require('axios');

    const makeApiCall = async (index) => {
        const payload = {
            clientId: "DEMOFONEXPAY",
            secretKey: "cd014fa580ac11100ec91c2c11da40121e0a795939b8b923ae2157f6dabb5f02",
            phoneNumber: "7740042471",
            amount: "1.00",
            transferMode: "IMPS",
            accountNo: "8052100222",
            ifscCode: "AIRP0000001",
            beneficiaryName: `Testing${index}`,
            vpa: "",
            clientOrderId: `237213${index}`
        };

        try {
            console.time(`Worker ${workerData.workerIndex} - Request-${index}`);
            const response = await axios.post('http://localhost:5001/payout/payout', payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000
            });
            console.timeEnd(`Worker ${workerData.workerIndex} - Request-${index}`);

            return {
                success: true,
                index,
                status: response.status,
                data: response.data
            };
        } catch (error) {
            console.timeEnd(`Worker ${workerData.workerIndex} - Request-${index}`);
            return {
                success: false,
                index,
                error: error.response?.data || error.message
            };
        }
    };

    // Execute calls assigned to this worker
    const executeWorkerCalls = async () => {
        const results = [];
        for (let i = 0; i < workerData.callCount; i++) {
            const currentIndex = workerData.startIndex + i;
            const result = await makeApiCall(currentIndex);
            results.push(result);
        }
        return results;
    };

    // Start processing and send results back to main thread
    executeWorkerCalls()
        .then(results => {
            parentPort.postMessage(results);
        })
        .catch(error => {
            console.error(`Worker ${workerData.workerIndex} error:`, error);
            process.exit(1);
        });
}