// scheme-service/api-config-dao.js
const Logger = require('../logger/logger');
const log = new Logger('API-Config-Dao');
const { db, apiConfigs } = require('../scheme-service/db/schema');
const { eq, and, like,sql } = require('drizzle-orm');
const {products} =require("../product-service/db/schema")

class ApiConfigDao {
    async createApiConfig(configData) {
        try {
            return await db.transaction(async (tx) => {
                // If setting as default, remove default flag from other APIs of same product
                if (configData.isDefault) {
                    await tx
                        .update(apiConfigs)
                        .set({ 
                            isDefault: false,
                            updatedAt: new Date()
                        })
                        .where(
                            and(
                                eq(apiConfigs.productId, configData.productId),
                                eq(apiConfigs.isDefault, true)
                            )
                        );
                }

                const [apiConfig] = await tx
                    .insert(apiConfigs)
                    .values({
                        ...configData,
                        status: configData.status || 'ACTIVE'
                    })
                    .returning();

                return apiConfig;
            });
        } catch (error) {
            log.error('Error creating API config:', error);
            throw error;
        }
    }

    async updateApiConfig(configId, configData) {
        try {
            return await db.transaction(async (tx) => {
                // If setting as default, update other configs
                if (configData.isDefault) {
                    const [currentConfig] = await tx
                        .select()
                        .from(apiConfigs)
                        .where(eq(apiConfigs.id, configId))
                        .limit(1);

                    if (currentConfig) {
                        await tx
                            .update(apiConfigs)
                            .set({ 
                                isDefault: false,
                                updatedAt: new Date()
                            })
                            .where(
                                and(
                                    eq(apiConfigs.productId, currentConfig.productId),
                                    eq(apiConfigs.isDefault, true)
                                )
                            );
                    }
                }

                const [updatedConfig] = await tx
                    .update(apiConfigs)
                    .set({
                        ...configData,
                        updatedAt: new Date()
                    })
                    .where(eq(apiConfigs.id, configId))
                    .returning();

                return updatedConfig;
            });
        } catch (error) {
            log.error('Error updating API config:', error);
            throw error;
        }
    }

    async getApiConfigs({ productId = null, status = null, search = null, page = 1, limit = 10 }) {
        try {
            // Build the where conditions array
            const conditions = [];
            
            if (productId) {
                conditions.push(eq(apiConfigs.productId, productId));
            }
    
            if (status) {
                conditions.push(eq(apiConfigs.status, status));
            }
    
            if (search) {
                conditions.push(like(apiConfigs.name, `%${search}%`));
            }
    
            // Base query with product join
            let query = db
                .select({
                    id: apiConfigs.id,
                    productId: apiConfigs.productId,
                    productName: products.name,
                    name: apiConfigs.name,
                    baseUrl: apiConfigs.baseUrl,
                    username: apiConfigs.username,
                    password: apiConfigs.password,
                    apiKey: apiConfigs.apiKey,
                    secretKey: apiConfigs.secretKey,
                    ipWhitelist: apiConfigs.ipWhitelist,
                    status: apiConfigs.status,
                    priority: apiConfigs.priority,
                    isDefault: apiConfigs.isDefault,
                    expiresAt: apiConfigs.expiresAt,
                    lastUsedAt: apiConfigs.lastUsedAt,
                    createdBy: apiConfigs.createdBy,
                    createdAt: apiConfigs.createdAt,
                    updatedAt: apiConfigs.updatedAt
                })
                .from(apiConfigs)
                .leftJoin(products, eq(apiConfigs.productId, products.id));
            
            // Apply where conditions if any exist
            if (conditions.length > 0) {
                query = query.where(and(...conditions));
            }
    
            const offset = (page - 1) * limit;
    
            // Execute both queries with the same conditions
            const [configs, totalResult] = await Promise.all([
                query
                    .limit(limit)
                    .offset(offset)
                    .orderBy(apiConfigs.priority, apiConfigs.createdAt),
                db
                    .select({ count: sql`count(*)` })
                    .from(apiConfigs)
                    .where(conditions.length > 0 ? and(...conditions) : undefined)
            ]);
    
            return {
                data: configs,
                pagination: {
                    page,
                    limit,
                    total: Number(totalResult[0].count),
                    pages: Math.ceil(Number(totalResult[0].count) / limit)
                }
            };
        } catch (error) {
            log.error('Error getting API configs:', error);
            throw error;
        }
    }

    async getApiConfigById(id) {
        try {
            const [config] = await db
                .select()
                .from(apiConfigs)
                .where(eq(apiConfigs.id, id))
                .limit(1);
            return config;
        } catch (error) {
            log.error('Error getting API config:', error);
            throw error;
        }
    }

    async getDefaultApiConfig(productId) {
        try {
            const [config] = await db
                .select()
                .from(apiConfigs)
                .where(
                    and(
                        eq(apiConfigs.productId, productId),
                        eq(apiConfigs.isDefault, true),
                        eq(apiConfigs.status, 'ACTIVE')
                    )
                )
                .limit(1);
                console.log("config--> ",productId)
            return config;
        } catch (error) {
            log.error('Error getting default API config:', error);
            throw error;
        }
    }

    async updateApiStatus(configId, status) {
        try {
            const [config] = await db
                .update(apiConfigs)
                .set({ 
                    status,
                    updatedAt: new Date()
                })
                .where(eq(apiConfigs.id, configId))
                .returning();
            return config;
        } catch (error) {
            log.error('Error updating API status:', error);
            throw error;
        }
    }
}

module.exports = new ApiConfigDao();