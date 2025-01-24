const express = require("express");
const app = express();
const morgan = require("morgan");
require("dotenv").config();
const cors = require("cors");
const prometheus = require('prom-client');
const environment = app.get("env");
app.use(express.json());


const collectDefaultMetrics = prometheus.collectDefaultMetrics;

// Create metrics
const requestCounter = new prometheus.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'path', 'status']
});

const requestDurationHistogram = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'path']
});

// Enable default metrics (CPU, memory etc)
collectDefaultMetrics();

app.use(
  cors({
    origin: "*", // Or specify your exact frontend origin
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "x-auth-token",
      "Authorization",
    ],
    exposedHeaders: ["x-auth-token"],
  }));

  const requestMetrics = {
    requests: [],
    windowSize: 1000, // 1 second window
   };

  app.use((req, res, next) => {
    requestMetrics.requests.push(Date.now());
    
    // Cleanup old requests
    const cutoff = Date.now() - requestMetrics.windowSize;
    requestMetrics.requests = requestMetrics.requests.filter(time => time > cutoff);
    
    next();
   });

app.get('/metrics/rps', (req, res) => {
  const now = Date.now();
  const cutoff = now - requestMetrics.windowSize;
  const recentRequests = requestMetrics.requests.filter(time => time > cutoff);
  const rps = recentRequests.length;
  
  res.json({ rps });
 });

const userservicerouter = require("./user-service/user-controller");
const permissionRouter = require("./user-service/permission-controller");
const roleRouter = require("./user-service/role-controller");
const kycRouter = require("./kyc-service/kyc-controller");
const schemeRouter = require("./scheme-service/scheme-controller");
const bankRouter = require("./bank-service/bank-controller");
const fundRouter = require("./fund-service/fund-controller");
const productRouter = require("./product-service/product-controller");
const apiConfigRouter = require("./api-config-service/api-config-controller");
const tokenRouter = require("./api-token-service/api-token-controller");
const callbackRouter = require("./callback-service/callback-controller");
const encryptionRouter = require("./encryption-service/encryption-controller");
const payinRouter = require("./payin-service/payin-controller");
const callbackProcessRouter = require("./callback-service/callback-process-controller");
const walletRouter = require("./wallet-service/wallet-controller");
const passwordRouter = require("./user-service/password-controller");
const payoutRouter = require("./payout-service/payout-controller");
const payoutStatusScheduler = require("./scheduler/payout-status-scheduler");
const paymentStatusScheduler = require("./scheduler/payment-status-scheduler");
const sessionRouter = require("./session-service/session-controller");

app.use("/user", userservicerouter);
app.use("/permissions", permissionRouter);
app.use("/roles", roleRouter);
app.use("/kyc", kycRouter);
app.use("/schemes", schemeRouter);
app.use("/bank", bankRouter);
app.use("/fund", fundRouter);
app.use("/products", productRouter);
app.use("/api-configs", apiConfigRouter);
app.use("/tokens", tokenRouter);
app.use("/callback", callbackRouter);
app.use("/validate", encryptionRouter);
app.use("/payin", payinRouter);
app.use("/callback-process", callbackProcessRouter);
app.use("/wallet", walletRouter);
app.use("/password", passwordRouter);
app.use("/payout", payoutRouter);
app.use("/sessions", sessionRouter);
if (environment === "development") {
  app.use(morgan("tiny"));
  console.log("Morgan is enabled...");
}
const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(
    `Application running in ${environment} environment, listening to port ${port}....`
  );
});

try {
  //  paymentStatusScheduler.start();
  //  payoutStatusScheduler.start();
  console.log("Payment status scheduler started successfully");
} catch (error) {
  console.error("Failed to start payment status scheduler:", error);
}
