// scheme-service/scheme-dao.js
const Logger = require('../logger/logger');
const log = new Logger('Scheme-Dao');
const { db, schemes, schemeCharges, userSchemes, apiConfigs, schemeTransactionLogs } = require('./db/schema');
const { eq, and, or, between, sql, desc, lte, gte,exists } = require('drizzle-orm');
const {products} =require("../product-service/db/schema");
class SchemeDao {
    async createScheme(schemeData) {
        try {
            return await db.transaction(async (tx) => {
                const [scheme] = await tx
                    .insert(schemes)
                    .values({
                        name: schemeData.name.trim(),
                        productId: schemeData.productId,
                        description: schemeData.description,
                        status: schemeData.status || 'ACTIVE',
                        minTransactionLimit: schemeData.minTransactionLimit,
                        maxTransactionLimit: schemeData.maxTransactionLimit,
                        dailyLimit: schemeData.dailyLimit,
                        monthlyLimit: schemeData.monthlyLimit,
                        createdBy: schemeData.createdBy
                    })
                    .returning();

                const chargesData = schemeData.charges.map(charge => ({
                    schemeId: scheme.id,
                    apiConfigId: charge.apiConfigId,
                    minAmount: charge.minAmount,
                    maxAmount: charge.maxAmount,
                    chargeType: charge.chargeType,
                    chargeValue: charge.chargeValue,
                    gst: charge.gst,
                    tds: charge.tds,
                    status: 'ACTIVE'
                }));

                const charges = await tx
                    .insert(schemeCharges)
                    .values(chargesData)
                    .returning();

                return {
                    ...scheme,
                    charges
                };
            });
        } catch (error) {
            console.log('Error creating scheme:', error);
            log.error('Error creating scheme:', error);
            throw error;
        }
    }

    async updateScheme(schemeId, schemeData) {
        try {
            return await db.transaction(async (tx) => {
                const [scheme] = await tx
                    .update(schemes)
                    .set({
                        name: schemeData.name?.trim(),
                        description: schemeData.description,
                        status: schemeData.status,
                        minTransactionLimit: schemeData.minTransactionLimit,
                        maxTransactionLimit: schemeData.maxTransactionLimit,
                        dailyLimit: schemeData.dailyLimit,
                        monthlyLimit: schemeData.monthlyLimit,
                        updatedAt: new Date()
                    })
                    .where(eq(schemes.id, schemeId))
                    .returning();

                if (schemeData.charges) {
                    await tx
                        .update(schemeCharges)
                        .set({ status: 'INACTIVE', updatedAt: new Date() })
                        .where(eq(schemeCharges.schemeId, schemeId));

                    const chargesData = schemeData.charges.map(charge => ({
                        schemeId: scheme.id,
                        apiConfigId: charge.apiConfigId,
                        minAmount: charge.minAmount,
                        maxAmount: charge.maxAmount,
                        chargeType: charge.chargeType,
                        chargeValue: charge.chargeValue,
                        gst: charge.gst,
                        tds: charge.tds,
                        status: 'ACTIVE'
                    }));

                    const charges = await tx
                        .insert(schemeCharges)
                        .values(chargesData)
                        .returning();

                    scheme.charges = charges;
                }

                return scheme;
            });
        } catch (error) {
            log.error('Error updating scheme:', error);
            throw error;
        }
    }

    async getSchemeById(schemeId) {
        try {
            const query = await db
                .select({
                    scheme: schemes,
                    charges: schemeCharges,
                    api: apiConfigs
                })
                .from(schemes)
                .leftJoin(schemeCharges, and(
                    eq(schemes.id, schemeCharges.schemeId),
                    eq(schemeCharges.status, 'ACTIVE')
                ))
                .leftJoin(apiConfigs, eq(schemeCharges.apiConfigId, apiConfigs.id))
                .where(eq(schemes.id, schemeId));

            if (!query.length) return null;

            // Group charges and format response
            const formattedScheme = {
                ...query[0].scheme,
                charges: query.map(row => row.charges ? {
                    ...row.charges,
                    api: row.api
                } : null).filter(Boolean)
            };

            return formattedScheme;
        } catch (error) {
            log.error('Error getting scheme:', error);
            throw error;
        }
    }
    async getSchemes({ 
        page = 1, 
        limit = 10, 
        productId = null, 
        status = null,
        search = null 
    }) {
        try {
            // Build base query with product information
            let baseQuery = db
                .select({
                    scheme: schemes,
                    product: products,
                    charges: schemeCharges,
                    api: apiConfigs
                })
                .from(schemes)
                .innerJoin(products, eq(schemes.productId, products.id))
                .leftJoin(schemeCharges, and(
                    eq(schemes.id, schemeCharges.schemeId),
                    eq(schemeCharges.status, 'ACTIVE')
                ))
                .leftJoin(apiConfigs, eq(schemeCharges.apiConfigId, apiConfigs.id));
    
            // Build conditions array
            let conditions = [];
    
            if (productId) {
                conditions.push(eq(schemes.productId, productId));
            }
            
            if (status) {
                conditions.push(eq(schemes.status, status));
            }
    
            if (search) {
                conditions.push(like(schemes.name, `%${search}%`));
            }
    
            // Apply conditions if any exist
            if (conditions.length > 0) {
                baseQuery = baseQuery.where(and(...conditions));
            }
    
            const offset = (page - 1) * limit;
    
            // Execute main query and count query
            const [results, totalCountResult] = await Promise.all([
                baseQuery
                    .limit(limit)
                    .offset(offset)
                    .orderBy(desc(schemes.createdAt)),
                
                db.select({
                    count: sql`count(distinct ${schemes.id})`
                })
                .from(schemes)
                .where(conditions.length > 0 ? and(...conditions) : undefined)
            ]);
    
            // Group charges by scheme
            const groupedSchemes = results.reduce((acc, row) => {
                if (!row.scheme) return acc;
    
                const existingScheme = acc.find(s => s.id === row.scheme.id);
                if (existingScheme) {
                    if (row.charges) {
                        // Check if this charge is already added
                        const chargeExists = existingScheme.charges.some(c => c.id === row.charges.id);
                        if (!chargeExists) {
                            existingScheme.charges.push({
                                ...row.charges,
                                api: row.api
                            });
                        }
                    }
                } else {
                    acc.push({
                        ...row.scheme,
                        product: {
                            id: row.product.id,
                            name: row.product.name
                        },
                        charges: row.charges ? [{
                            ...row.charges,
                            api: row.api
                        }] : []
                    });
                }
                return acc;
            }, []);
    
            const total = Number(totalCountResult[0]?.count || 0);
    
            return {
                data: groupedSchemes,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            log.error('Error getting schemes:', error);
            throw error;
        }
    }
    async calculateCharges(amount, schemeId, productId) {
        try {
            // Get scheme charges and API configuration
            const chargeQuery = await db
                .select({
                    scheme: schemes,
                    charge: schemeCharges,
                    api: apiConfigs
                })
                .from(schemes)
                .innerJoin(schemeCharges, eq(schemes.id, schemeCharges.schemeId))
                .innerJoin(apiConfigs, eq(schemeCharges.apiConfigId, apiConfigs.id))
                .where(
                    and(
                        eq(schemes.id, schemeId),
                        eq(schemes.status, 'ACTIVE'),
                        eq(schemeCharges.status, 'ACTIVE'),
                        eq(apiConfigs.status, 'ACTIVE'),
                        productId === 2 ? and(
                            lte(schemeCharges.minAmount, amount),
                            gte(schemeCharges.maxAmount, amount)
                        ) : sql`1=1`
                    )
                );

            if (!chargeQuery.length) {
                throw new Error('No applicable charges found for this amount');
            }

            const { charge, api } = chargeQuery[0];

            // Calculate base charge
            const baseCharge = charge.chargeType === 'FLAT' 
                ? +charge.chargeValue 
                : (+amount * +charge.chargeValue) / 100;

            // Calculate GST if applicable
            const gstAmount = +charge.gst ? +(+baseCharge * +charge.gst) / 100 : 0;

            // Calculate TDS if applicable
            const tdsAmount = +charge.tds ? (+amount * +charge.tds) / 100 : 0;

            // Total amount including all charges
            const totalCharges = +baseCharge + +gstAmount;
            const finalAmount = +amount + +totalCharges - +tdsAmount;

            return {
                api: {
                    id: api.id,
                    name: api.name,
                    baseUrl: api.baseUrl
                },
                charges: {
                    originalAmount: amount,
                    chargeType: charge.chargeType,
                    chargeValue: charge.chargeValue,
                    baseCharge,
                    gst: {
                        percentage: charge.gst || 0,
                        amount: gstAmount
                    },
                    tds: {
                        percentage: charge.tds || 0,
                        amount: tdsAmount
                    },
                    totalCharges,
                    finalAmount
                }
            };
        } catch (error) {
            log.error('Error calculating charges:', error);
            throw error;
        }
    }

    async assignSchemeToUser(userId, schemeId, assignedBy) {
        try {
            return await db.transaction(async (tx) => {
                // Deactivate existing schemes of same product type
                const [existingScheme] = await tx
                    .select({
                        scheme: schemes
                    })
                    .from(schemes)
                    .where(eq(schemes.id, schemeId))
                    .limit(1);

                if (existingScheme) {
                    await tx
                        .update(userSchemes)
                        .set({ 
                            status: 'INACTIVE',
                            updatedAt: new Date()
                        })
                        .where(
                            and(
                                eq(userSchemes.userId, userId),
                                exists(
                                    db.select()
                                        .from(schemes)
                                        .where(
                                            and(
                                                eq(schemes.id, userSchemes.schemeId),
                                                eq(schemes.productId, existingScheme.scheme.productId)
                                            )
                                        )
                                )
                            )
                        );
                }

                // Assign new scheme
                const [assignment] = await tx
                    .insert(userSchemes)
                    .values({
                        userId,
                        schemeId,
                        status: 'ACTIVE',
                        createdBy: assignedBy
                    })
                    .returning();

                return assignment;
            });
        } catch (error) {
            log.error('Error assigning scheme to user:', error);
            throw error;
        }
    }

    async logSchemeTransaction(transactionData) {
        try {
            const [log] = await db
                .insert(schemeTransactionLogs)
                .values(transactionData)
                .returning();
            return log;
        } catch (error) {
            log.error('Error logging scheme transaction:', error);
            throw error;
        }
    }

    async getUserSchemes(userId, productId = null) {
        try {
            let query = db
                .select({
                    scheme: schemes,
                    assignment: userSchemes,
                    charges: schemeCharges,
                    api: apiConfigs
                })
                .from(userSchemes)
                .innerJoin(schemes, eq(userSchemes.schemeId, schemes.id))
                .leftJoin(
                    schemeCharges, 
                    and(
                        eq(schemes.id, schemeCharges.schemeId),
                        eq(schemeCharges.status, 'ACTIVE')
                    )
                )
                .leftJoin(apiConfigs, eq(schemeCharges.apiConfigId, apiConfigs.id))
                .where(
                    and(
                        eq(userSchemes.userId, userId),
                        eq(userSchemes.status, 'ACTIVE')
                    )
                );
    
            if (productId) {
                query = query.where(eq(schemes.productId, productId));
            }
    
            const results = await query;
    
            // Use a Map to track unique charges by their ID for each scheme
            const schemesMap = new Map();
    
            results.forEach(row => {
                if (!schemesMap.has(row.scheme.id)) {
                    // Initialize new scheme entry
                    schemesMap.set(row.scheme.id, {
                        ...row.scheme,
                        assignmentId: row.assignment.id,
                        charges: new Map() // Use Map to track unique charges
                    });
                }
    
                const schemeEntry = schemesMap.get(row.scheme.id);
    
                // Only add charge if it exists and hasn't been added yet
                if (row.charges && !schemeEntry.charges.has(row.charges.id)) {
                    schemeEntry.charges.set(row.charges.id, {
                        ...row.charges,
                        api: row.api
                    });
                }
            });
    
            // Convert Map to array format with charges array
            const groupedSchemes = Array.from(schemesMap.values()).map(scheme => ({
                ...scheme,
                charges: Array.from(scheme.charges.values())
            }));
    
            return groupedSchemes;
        } catch (error) {
            log.error('Error getting user schemes:', error);
            throw error;
        }
    }
    async  getUsersWithSchemes({ page = 1, limit = 10, status = null, productId = null }) {
        try {
            const offset = (page - 1) * limit;
            
            // Build the query with optional filters
            let query = db
                .select({
                    user: {
                        id: users.id,
                        username: users.username,
                        firstname: users.firstname,
                        lastname: users.lastname,
                        emailId: users.emailId,
                        phoneNo: users.phoneNo,
                        isActive: users.isActive
                    },
                    schemeDetails: sql`
                        COALESCE(
                            json_agg(
                                DISTINCT jsonb_build_object(
                                    'schemeId', ${schemes.id},
                                    'schemeName', ${schemes.name},
                                    'status', ${userSchemes.status},
                                    'assignedAt', ${userSchemes.createdAt},
                                    'product', jsonb_build_object(
                                        'id', ${products.id},
                                        'name', ${products.name}
                                    )
                                )
                            ) FILTER (WHERE ${schemes.id} IS NOT NULL),
                            '[]'
                        )
                    `.as('schemeDetails')
                })
                .from(users)
                .leftJoin(userSchemes, eq(users.id, userSchemes.userId))
                .leftJoin(schemes, eq(userSchemes.schemeId, schemes.id))
                .leftJoin(products, eq(schemes.productId, products.id));
    
            // Apply filters
            if (status) {
                query = query.where(eq(userSchemes.status, status));
            }
    
            if (productId) {
                query = query.where(eq(products.id, productId));
            }
    
            // Add grouping
            query = query
                .groupBy(users.id)
                .orderBy(desc(users.createdAt))
                .limit(limit)
                .offset(offset);
    
            // Execute main query
            const usersData = await query;
    
            // Get total count
            const [{ count }] = await db
                .select({ 
                    count: sql`COUNT(DISTINCT ${users.id})` 
                })
                .from(users)
                .leftJoin(userSchemes, eq(users.id, userSchemes.userId))
                .leftJoin(schemes, eq(userSchemes.schemeId, schemes.id))
                .leftJoin(products, eq(schemes.productId, products.id))
                .where(query.where);
    
            // Process the results
            const processedUsers = usersData.map(userData => ({
                ...userData.user,
                schemes: userData.schemeDetails,
                schemeStatus: userData.schemeDetails.length > 0 ? 'ASSIGNED' : 'NOT_ASSIGNED'
            }));
    
            return {
                data: processedUsers,
                pagination: {
                    page,
                    limit,
                    total: Number(count),
                    pages: Math.ceil(Number(count) / limit)
                }
            };
        } catch (error) {
            log.error('Error getting users with schemes:', error);
            throw error;
        }
    }
}

module.exports = new SchemeDao();