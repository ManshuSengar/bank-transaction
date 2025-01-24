// kyc-service/kyc-dao.js
const Logger = require("../logger/logger");
const log = new Logger("KYC-Dao");
const { db, aadharVerifications, panVerifications } = require("./db/schema");
const { eq } = require("drizzle-orm");

class KycDao {
  async submitAadharVerification(userId, verificationData, documentPath) {
    try {
      const [verification] = await db
        .insert(aadharVerifications)
        .values({
          userId,
          aadharNumber: verificationData.aadharNumber,
          fullName: verificationData.fullName,
          dateOfBirth: new Date(verificationData.dateOfBirth),
          gender: verificationData.gender,
          address: verificationData.address,
          documentImagePath: documentPath,
          verificationStatus: "PENDING",
        })
        .returning();
      return verification;
    } catch (error) {
      log.error("Error submitting Aadhar verification:", error);
      throw error;
    }
  }

  async submitPanVerification(userId, verificationData, documentPath) {
    try {
      const [verification] = await db
        .insert(panVerifications)
        .values({
          userId,
          panNumber: verificationData.panNumber.toUpperCase(),
          fullName: verificationData.fullName,
          dateOfBirth: new Date(verificationData.dateOfBirth),
          documentImagePath: documentPath,
          verificationStatus: "PENDING",
        })
        .returning();
      return verification;
    } catch (error) {
      log.error("Error submitting PAN verification:", error);
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
      log.error("Error getting Aadhar verification status:", error);
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
      log.error("Error getting PAN verification status:", error);
      throw error;
    }
  }

  async verifyAadhar(verificationId, status, comments) {
    try {
      const [verification] = await db
        .update(aadharVerifications)
        .set({
          isVerified: status === "APPROVED",
          verificationStatus: status,
          verificationComments: comments,
          verifiedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(aadharVerifications.id, verificationId))
        .returning();
      return verification;
    } catch (error) {
      log.error("Error updating Aadhar verification:", error);
      throw error;
    }
  }

  async verifyPan(verificationId, status, comments) {
    try {
      const [verification] = await db
        .update(panVerifications)
        .set({
          isVerified: status === "APPROVED",
          verificationStatus: status,
          verificationComments: comments,
          verifiedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(panVerifications.id, verificationId))
        .returning();
      return verification;
    } catch (error) {
      log.error("Error updating PAN verification:", error);
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
      log.error("Error getting Aadhar by number:", error);
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
      log.error("Error getting PAN by number:", error);
      throw error;
    }
  }

  async getAllPendingVerifications() {
    try {
      const aadharPending = await db
        .select()
        .from(aadharVerifications)
        .where(eq(aadharVerifications.verificationStatus, "PENDING"));

      const panPending = await db
        .select()
        .from(panVerifications)
        .where(eq(panVerifications.verificationStatus, "PENDING"));

      return {
        aadharVerifications: aadharPending,
        panVerifications: panPending,
      };
    } catch (error) {
      log.error("Error getting pending verifications:", error);
      throw error;
    }
  }

  // Add these methods to KycDao class in kyc-dao.js

  async getAadharVerificationById(verificationId) {
    try {
      const verification = await db
        .select({
          verification: aadharVerifications,
          user: {
            id: users.id,
            username: users.username,
            emailId: users.emailId,
            phoneNo: users.phoneNo,
          },
        })
        .from(aadharVerifications)
        .innerJoin(users, eq(aadharVerifications.userId, users.id))
        .where(eq(aadharVerifications.id, verificationId))
        .limit(1);

      return verification[0];
    } catch (error) {
      log.error("Error getting Aadhar verification by ID:", error);
      throw error;
    }
  }

  async getPanVerificationById(verificationId) {
    try {
      const verification = await db
        .select({
          verification: panVerifications,
          user: {
            id: users.id,
            username: users.username,
            emailId: users.emailId,
            phoneNo: users.phoneNo,
          },
        })
        .from(panVerifications)
        .innerJoin(users, eq(panVerifications.userId, users.id))
        .where(eq(panVerifications.id, verificationId))
        .limit(1);

      return verification[0];
    } catch (error) {
      log.error("Error getting PAN verification by ID:", error);
      throw error;
    }
  }
  async getUserVerifications(userId) {
    try {
        const [aadharVerification, panVerification] = await Promise.all([
            db
                .select()
                .from(aadharVerifications)
                .where(eq(aadharVerifications.userId, userId))
                .limit(1),
            db
                .select()
                .from(panVerifications)
                .where(eq(panVerifications.userId, userId))
                .limit(1)
        ]);

        return {
            aadhar: aadharVerification[0] || null,
            pan: panVerification[0] || null
        };
    } catch (error) {
        log.error('Error getting user verifications:', error);
        throw error;
    }
}
}

module.exports = new KycDao();
