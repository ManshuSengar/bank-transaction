const express = require('express');
const app = express();
const morgan = require('morgan');
require('dotenv').config();

const environment = app.get('env');
console.log('process env', process.env.NODE_ENV);
app.use(express.json());

// CORS Configuration
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "http://localhost:4200");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, x-auth-token");
    res.header("Access-Control-Expose-Headers", "x-auth-token");
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Import routers
const userservicerouter = require('./user-service/user-controller');
const permissionRouter = require('./user-service/permission-controller');
const roleRouter = require('./user-service/role-controller');
// const accountservicerouter = require('./account-service/account-controller');
// const transactionservicerouter = require('./transaction-service/transaction-controller');
const kycRouter = require('./kyc-service/kyc-controller');
// Use routers
app.use('/bankingapp/api/user', userservicerouter);
app.use('/bankingapp/api/permissions', permissionRouter);
app.use('/bankingapp/api/roles', roleRouter);
app.use('/bankingapp/api/kyc', kycRouter);

// app.use('/bankingapp/api/account', accountservicerouter);
// app.use('/bankingapp/api/transaction', transactionservicerouter);

if(environment === 'development'){
    app.use(morgan('tiny'));
    console.log('Morgan is enabled...');
}

const port = process.env.PORT || 8081;

app.listen(port, () => {
    console.log(`Application running in ${environment} environment, listening to port ${port}....`);
});