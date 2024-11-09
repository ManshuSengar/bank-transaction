// scheme-service/scheme-dao.js
const Logger = require('../logger/logger');
const log = new Logger('Scheme-Dao');
const { db, schemes, schemeCharges, userSchemes } = require('./db/schema');
const { eq, and } = require('drizzle-orm');

class SchemeDao {
    async checkSchemeExists(name) {
        try {
            const result = await db
                .select()
                .from(schemes)
                .where(eq(schemes.name, name.trim()))
                .limit(1);
            
            return result.length > 0 ? result[0] : null;
        } catch (error) {
            log.error('Error checking scheme existence:', error);
            throw error;
        }
    }

    async createScheme(schemeData) {
        try {
            // Check if scheme with same name exists
            const existingScheme = await this.checkSchemeExists(schemeData.name);
            if (existingScheme) {
                const error = new Error('Scheme with this name already exists');
                error.code = 'SCHEME_EXISTS';
                error.statusCode = 409; // Conflict
                throw error;
            }

            const [scheme] = await db.insert(schemes)
                .values({
                    name: schemeData.name.trim(),
                    status: schemeData.status || 'INACTIVE',
                    createdBy: schemeData.createdBy
                })
                .returning();
            return scheme;
        } catch (error) {
            log.error('Error creating scheme:', error);
            // Check if it's a unique constraint violation from PostgreSQL
            if (error.code === '23505') {
                const customError = new Error('Scheme with this name already exists');
                customError.code = 'SCHEME_EXISTS';
                customError.statusCode = 409;
                throw customError;
            }
            throw error;
        }
    }

    async addSchemeCharges(schemeId, chargesData) {
        try {
            const charges = [];
            for (const charge of chargesData.charges) {
                const [newCharge] = await db.insert(schemeCharges)
                    .values({
                        schemeId,
                        payoutRange: charge.payoutRange,
                        chargeType: charge.chargeType,
                        chargeValue: charge.chargeValue,
                        partnerValue: charge.partnerValue,
                        apiuserValue: charge.apiuserValue
                    })
                    .returning();
                charges.push(newCharge);
            }
            return charges;
        } catch (error) {
            log.error('Error adding scheme charges:', error);
            throw error;
        }
    }

    async assignSchemeToUser(userId, schemeId) {
        try {
            const [assignment] = await db.insert(userSchemes)
                .values({
                    userId,
                    schemeId,
                    status: 'ACTIVE'
                })
                .returning();
            return assignment;
        } catch (error) {
            log.error('Error assigning scheme:', error);
            throw error;
        }
    }

    async getSchemeById(schemeId) {
        try {
            const scheme = await db
                .select()
                .from(schemes)
                .where(eq(schemes.id, schemeId))
                .limit(1);

            if (scheme.length === 0) {
                return null;
            }

            const charges = await db
                .select()
                .from(schemeCharges)
                .where(eq(schemeCharges.schemeId, schemeId));

            return {
                ...scheme[0],
                charges
            };
        } catch (error) {
            log.error('Error getting scheme:', error);
            throw error;
        }
    }

    async updateSchemeStatus(schemeId, status) {
        try {
            const [scheme] = await db.update(schemes)
                .set({
                    status,
                    updatedAt: new Date()
                })
                .where(eq(schemes.id, schemeId))
                .returning();
            return scheme;
        } catch (error) {
            log.error('Error updating scheme status:', error);
            throw error;
        }
    }

    async getAllSchemes() {
        try {
            return await db
                .select()
                .from(schemes)
                .orderBy(schemes.createdAt);
        } catch (error) {
            log.error('Error getting all schemes:', error);
            throw error;
        }
    }

    async getSchemesByUser(userId) {
        try {
            const userSchemesList = await db
                .select({
                    scheme: schemes
                })
                .from(userSchemes)
                .innerJoin(schemes, eq(userSchemes.schemeId, schemes.id))
                .where(eq(userSchemes.userId, userId))
                .where(eq(userSchemes.status, 'ACTIVE'));

            return userSchemesList.map(item => item.scheme);
        } catch (error) {
            log.error('Error getting user schemes:', error);
            throw error;
        }
    }
}

module.exports = new SchemeDao();