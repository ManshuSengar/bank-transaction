// kyc-service/kyc-controller.js
const express = require('express');
const kycRouter = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const kycDao = require('./kyc-dao');
const { aadharVerificationSchema, panVerificationSchema, documentUploadSchema } = require('./kyc-schema-model');
const Logger = require('../logger/logger');
const log = new Logger('KYC-Controller');
const { authenticateToken, authorize } = require('../middleware/auth-token-validator');

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: async function (req, file, cb) {
        const dir = path.join(__dirname, '../uploads/kyc');
        try {
            await fs.mkdir(dir, { recursive: true });
            cb(null, dir);
        } catch (error) {
            cb(error);
        }
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/jpg') {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPEG, JPG and PNG files are allowed.'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    }
});

// Submit Aadhar verification
kycRouter.post('/aadhar/verify',
    authenticateToken,
    upload.single('document'),
    async (req, res) => {
        try {
            // Validate document upload
            const { error: uploadError } = documentUploadSchema.validate({
                file: {
                    mimetype: req.file.mimetype,
                    size: req.file.size
                }
            });

            if (uploadError) {
                await fs.unlink(req.file.path);
                return res.status(400).send({
                    messageCode: 'INVALID_FILE',
                    message: uploadError.details[0].message
                });
            }

            // Validate Aadhar details
            const { error: dataError } = aadharVerificationSchema.validate(req.body);
            if (dataError) {
                await fs.unlink(req.file.path);
                return res.status(400).send({
                    messageCode: 'VALIDATION_ERROR',
                    message: dataError.details[0].message
                });
            }

            // Check if Aadhar is already verified
            const existingVerification = await kycDao.getAadharByNumber(req.body.aadharNumber);
            if (existingVerification) {
                await fs.unlink(req.file.path);
                return res.status(400).send({
                    messageCode: 'ALREADY_EXISTS',
                    message: 'This Aadhar number is already registered'
                });
            }

            const verification = await kycDao.submitAadharVerification(
                req.user.userId,
                req.body,
                req.file.path
            );

            res.status(201).send({
                messageCode: 'VERIFICATION_SUBMITTED',
                message: 'Aadhar verification submitted successfully',
                verificationId: verification.id
            });
        } catch (error) {
            console.log("error--> ",error);
            if (req.file) {
                await fs.unlink(req.file.path).catch(err => log.error('Error deleting file:', err));
            }
            log.error('Error in Aadhar verification:', error);
            res.status(500).send({
                messageCode: 'INTERNAL_ERROR',
                message: 'An error occurred during Aadhar verification'
            });
        }
    });

// Submit PAN verification
kycRouter.post('/pan/verify',
    authenticateToken,
    upload.single('document'),
    async (req, res) => {
        try {
            // Validate document upload
            const { error: uploadError } = documentUploadSchema.validate({
                file: {
                    mimetype: req.file.mimetype,
                    size: req.file.size
                }
            });

            if (uploadError) {
                await fs.unlink(req.file.path);
                return res.status(400).send({
                    messageCode: 'INVALID_FILE',
                    message: uploadError.details[0].message
                });
            }

            // Validate PAN details
            const { error: dataError } = panVerificationSchema.validate(req.body);
            if (dataError) {
                await fs.unlink(req.file.path);
                return res.status(400).send({
                    messageCode: 'VALIDATION_ERROR',
                    message: dataError.details[0].message
                });
            }

            // Check if PAN is already verified
            const existingVerification = await kycDao.getPanByNumber(req.body.panNumber);
            if (existingVerification) {
                await fs.unlink(req.file.path);
                return res.status(400).send({
                    messageCode: 'ALREADY_EXISTS',
                    message: 'This PAN number is already registered'
                });
            }

            const verification = await kycDao.submitPanVerification(
                req.user.userId,
                req.body,
                req.file.path
            );

            res.status(201).send({
                messageCode: 'VERIFICATION_SUBMITTED',
                message: 'PAN verification submitted successfully',
                verificationId: verification.id
            });
        } catch (error) {
            if (req.file) {
                await fs.unlink(req.file.path).catch(err => log.error('Error deleting file:', err));
            }
            log.error('Error in PAN verification:', error);
            res.status(500).send({
                messageCode: 'INTERNAL_ERROR',
                message: 'An error occurred during PAN verification'
            });
        }
    });

// Get verification status
kycRouter.get('/status',
    authenticateToken,
    async (req, res) => {
        try {
            const [aadharStatus, panStatus] = await Promise.all([
                kycDao.getAadharVerificationStatus(req.user.userId),
                kycDao.getPanVerificationStatus(req.user.userId)
            ]);

            res.send({
                aadhar: aadharStatus,
                pan: panStatus
            });
        } catch (error) {
            log.error('Error getting verification status:', error);
            res.status(500).send({
                messageCode: 'INTERNAL_ERROR',
                message: 'An error occurred while getting verification status'
            });
        }
    });

// Admin routes for verification approval/rejection
kycRouter.put('/aadhar/:verificationId/verify',
    authenticateToken,
    // authorize(['manage_kyc']),
    async (req, res) => {
        try {
            const { status, comments } = req.body;
            if (!['APPROVED', 'REJECTED'].includes(status)) {
                return res.status(400).send({
                    messageCode: 'INVALID_STATUS',
                    message: 'Invalid verification status'
                });
            }

            const verification = await kycDao.verifyAadhar(req.params.verificationId, status, comments);
            res.send({
                messageCode: 'VERIFICATION_UPDATED',
                message: `Aadhar verification ${status.toLowerCase()}`,
                verification
            });
        } catch (error) {
            log.error('Error updating Aadhar verification:', error);
            res.status(500).send({
                messageCode: 'INTERNAL_ERROR',
                message: 'An error occurred while updating verification'
            });
        }
    });

kycRouter.put('/pan/:verificationId/verify',
    authenticateToken,
    // authorize(['manage_kyc']),
    async (req, res) => {
        try {
            const { status, comments } = req.body;
            if (!['APPROVED', 'REJECTED'].includes(status)) {
                return res.status(400).send({
                    messageCode: 'INVALID_STATUS',
                    message: 'Invalid verification status'
                });
            }

            const verification = await kycDao.verifyPan(req.params.verificationId, status, comments);
            res.send({
                messageCode: 'VERIFICATION_UPDATED',
                message: `PAN verification ${status.toLowerCase()}`,
                verification
            });
        } catch (error) {
            log.error('Error updating PAN verification:', error);
            res.status(500).send({
                messageCode: 'INTERNAL_ERROR',
                message: 'An error occurred while updating verification'
            });
        }
    });

// Get all pending verifications (Admin only)
kycRouter.get('/pending',
    authenticateToken,
    // authorize(['manage_kyc']),
    async (req, res) => {
        try {
            const pending = await kycDao.getAllPendingVerifications();
            res.send(pending);
        } catch (error) {
            log.error('Error getting pending verifications:', error);
            res.status(500).send({
                messageCode: 'INTERNAL_ERROR',
                message: 'An error occurred while getting pending verifications'
            });
        }
    });


kycRouter.get('/aadhar/:verificationId',
    authenticateToken,
    async (req, res) => {
        try {
            const verification = await kycDao.getAadharVerificationById(req.params.verificationId);
            
            if (!verification) {
                return res.status(404).send({
                    messageCode: 'NOT_FOUND',
                    message: 'Aadhar verification not found'
                });
            }

            // Check if user has permission to view this verification
            if (verification.user.id !== req.user.userId && !req.user.permissions?.includes('manage_kyc')) {
                return res.status(403).send({
                    messageCode: 'FORBIDDEN',
                    message: 'Access denied'
                });
            }

            res.send({
                messageCode: 'VERIFICATION_FETCHED',
                message: 'Aadhar verification details retrieved successfully',
                data: verification
            });
        } catch (error) {
            log.error('Error getting Aadhar verification:', error);
            res.status(500).send({
                messageCode: 'INTERNAL_ERROR',
                message: 'An error occurred while retrieving Aadhar verification'
            });
        }
    });

kycRouter.get('/pan/:verificationId',
    authenticateToken,
    async (req, res) => {
        try {
            const verification = await kycDao.getPanVerificationById(req.params.verificationId);
            
            if (!verification) {
                return res.status(404).send({
                    messageCode: 'NOT_FOUND',
                    message: 'PAN verification not found'
                });
            }

            // Check if user has permission to view this verification
            if (verification.user.id !== req.user.userId && !req.user.permissions?.includes('manage_kyc')) {
                return res.status(403).send({
                    messageCode: 'FORBIDDEN',
                    message: 'Access denied'
                });
            }

            res.send({
                messageCode: 'VERIFICATION_FETCHED',
                message: 'PAN verification details retrieved successfully',
                data: verification
            });
        } catch (error) {
            log.error('Error getting PAN verification:', error);
            res.status(500).send({
                messageCode: 'INTERNAL_ERROR',
                message: 'An error occurred while retrieving PAN verification'
            });
        }
    });


    // Get user's KYC details from token
kycRouter.get('/details', 
    authenticateToken,
    async (req, res) => {
        try {
            const verifications = await kycDao.getUserVerifications(req.user.userId);
            
            res.send({
                messageCode: 'KYC_FETCHED',
                message: 'KYC details retrieved successfully',
                data: verifications
            });
        } catch (error) {
            log.error('Error getting user KYC details:', error);
            res.status(500).send({
                messageCode: 'INTERNAL_ERROR',
                message: 'An error occurred while retrieving KYC details'
            });
        }
    });
module.exports = kycRouter;