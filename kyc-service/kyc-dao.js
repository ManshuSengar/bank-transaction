// kyc-service/kyc-dao.js
const Logger = require('../logger/logger');
const log = new Logger('KYC-Dao');
const { db, aadharVerifications, panVerifications } = require('./db/schema');
const { eq } = require('drizzle-orm');

class KycDao {
    async submitAadharVerification(userId, verificationData, documentPath) {
        try {
            const [verification] = await db.insert(aadharVerifications)
                .values({
                    userId,
                    aadharNumber: verificationData.aadharNumber,
                    fullName: verificationData.fullName,
                    dateOfBirth: new Date(verificationData.dateOfBirth),
                    gender: verificationData.gender,
                    address: verificationData.address,
                    documentImagePath: documentPath,
                    verificationStatus: 'PENDING' // status
                })
                .returning();
            return verification;
        } catch (error) {
            log.error('Error submitting Aadhar verification:', error);
            throw error;
        }
    }

    async submitPanVerification(userId, verificationData, documentPath) {
        try {
            const [verification] = await db.insert(panVerifications)
                .values({
                    userId,
                    panNumber: verificationData.panNumber.toUpperCase(),
                    fullName: verificationData.fullName,
                    dateOfBirth: new Date(verificationData.dateOfBirth),
                    documentImagePath: documentPath,
                    verificationStatus: 'PENDING'
                })
                .returning();
            return verification;
        } catch (error) {
            log.error('Error submitting PAN verification:', error);
            throw error;
        }
    }

    async getAadharVerificationStatus(userId) {
        try {
            const verification = await db
                .select()
                .from(aadharVerifications)
                .where(eq(aadharVerifications.userId, userId))
                .limit(1);
            return verification[0];
        } catch (error) {
            log.error('Error getting Aadhar verification status:', error);
            throw error;
        }
    }

    async getPanVerificationStatus(userId) {
        try {
            const verification = await db
                .select()
                .from(panVerifications)
                .where(eq(panVerifications.userId, userId))
                .limit(1);
            return verification[0];
        } catch (error) {
            log.error('Error getting PAN verification status:', error);
            throw error;
        }
    }

    async verifyAadhar(verificationId, status, comments) {
        try {
            const [verification] = await db
                .update(aadharVerifications)
                .set({
                    isVerified: status === 'APPROVED',
                    verificationStatus: status,
                    verificationComments: comments,
                    verifiedAt: new Date(),
                    updatedAt: new Date()
                })
                .where(eq(aadharVerifications.id, verificationId))
                .returning();
            return verification;
        } catch (error) {
            log.error('Error updating Aadhar verification:', error);
            throw error;
        }
    }

    async verifyPan(verificationId, status, comments) {
        try {
            const [verification] = await db
                .update(panVerifications)
                .set({
                    isVerified: status === 'APPROVED',
                    verificationStatus: status,
                    verificationComments: comments,
                    verifiedAt: new Date(),
                    updatedAt: new Date()
                })
                .where(eq(panVerifications.id, verificationId))
                .returning();
            return verification;
        } catch (error) {
            log.error('Error updating PAN verification:', error);
            throw error;
        }
    }

    async getAadharByNumber(aadharNumber) {
        try {
            const verification = await db
                .select()
                .from(aadharVerifications)
                .where(eq(aadharVerifications.aadharNumber, aadharNumber))
                .limit(1);
            return verification[0];
        } catch (error) {
            log.error('Error getting Aadhar by number:', error);
            throw error;
        }
    }

    async getPanByNumber(panNumber) {
        try {
            const verification = await db
                .select()
                .from(panVerifications)
                .where(eq(panVerifications.panNumber, panNumber.toUpperCase()))
                .limit(1);
            return verification[0];
        } catch (error) {
            log.error('Error getting PAN by number:', error);
            throw error;
        }
    }

    async getAllPendingVerifications() {
        try {
            const aadharPending = await db
                .select()
                .from(aadharVerifications)
                .where(eq(aadharVerifications.verificationStatus, 'PENDING'));
                
            const panPending = await db
                .select()
                .from(panVerifications)
                .where(eq(panVerifications.verificationStatus, 'PENDING'));

            return {
                aadharVerifications: aadharPending,
                panVerifications: panPending
            };
        } catch (error) {
            log.error('Error getting pending verifications:', error);
            throw error;
        }
    }
}

module.exports = new KycDao();
