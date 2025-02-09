// scheme-service/scheme-dao.js
const Logger = require("../logger/logger");
const log = new Logger("Scheme-Dao");
const {
  db,
  schemes,
  schemeCharges,
  userSchemes,
  apiConfigs,
  schemeTransactionLogs,
} = require("./db/schema");
const {
  eq,
  and,
  or,
  between,
  sql,
  desc,
  lte,
  gte,
  exists,
  asc
} = require("drizzle-orm");
const { products } = require("../product-service/db/schema");
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
            status: schemeData.status || "ACTIVE",
            minTransactionLimit: schemeData.minTransactionLimit,
            maxTransactionLimit: schemeData.maxTransactionLimit,
            dailyLimit: schemeData.dailyLimit,
            monthlyLimit: schemeData.monthlyLimit,
            createdBy: schemeData.createdBy,
          })
          .returning();

        const chargesData = schemeData.charges.map((charge) => ({
          schemeId: scheme.id,
          apiConfigId: charge.apiConfigId,
          minAmount: charge.minAmount,
          maxAmount: charge.maxAmount,
          chargeType: charge.chargeType,
          chargeValue: charge.chargeValue,
          gst: charge.gst,
          tds: charge.tds,
          status: "ACTIVE",
        }));

        const charges = await tx
          .insert(schemeCharges)
          .values(chargesData)
          .returning();

        return {
          ...scheme,
          charges,
        };
      });
    } catch (error) {
      console.log("Error creating scheme:", error);
      log.error("Error creating scheme:", error);
      throw error;
    }
  }

  async updateScheme(schemeId, schemeData) {
    try {
        return await db.transaction(async (tx) => {
            if (schemeData.name) {
                const existingScheme = await tx
                    .select()
                    .from(schemes)
                    .where(
                        and(
                            eq(schemes.name, schemeData.name.trim()),
                            !eq(schemes.id, schemeId)
                        )
                    )
                    .limit(1);

                if (existingScheme.length > 0) {
                    const error = new Error("Scheme with this name already exists");
                    error.statusCode = 400;
                    error.messageCode = "DUPLICATE_SCHEME_NAME";
                    throw error;
                }
            }

            // Update the scheme with all fields including productId
            const [scheme] = await tx
                .update(schemes)
                .set({
                    ...(schemeData.name && { name: schemeData.name.trim() }),
                    ...(schemeData.productId && { productId: schemeData.productId }),
                    ...(schemeData.description && {
                        description: schemeData.description,
                    }),
                    ...(schemeData.status && { status: schemeData.status }),
                    ...(schemeData.minTransactionLimit && {
                        minTransactionLimit: schemeData.minTransactionLimit,
                    }),
                    ...(schemeData.maxTransactionLimit && {
                        maxTransactionLimit: schemeData.maxTransactionLimit,
                    }),
                    ...(schemeData.dailyLimit && { dailyLimit: schemeData.dailyLimit }),
                    ...(schemeData.monthlyLimit && {
                        monthlyLimit: schemeData.monthlyLimit,
                    }),
                    updatedAt: new Date(),
                })
                .where(eq(schemes.id, schemeId))
                .returning();

            // Handle charges update
            if (schemeData.charges) {
                // Deactivate existing charges
                await tx
                    .update(schemeCharges)
                    .set({ status: "INACTIVE", updatedAt: new Date() })
                    .where(eq(schemeCharges.schemeId, schemeId));

                // Insert new charges
                const chargesData = schemeData.charges.map((charge) => ({
                    schemeId: scheme.id,
                    apiConfigId: charge.apiConfigId,
                    minAmount: charge.minAmount,
                    maxAmount: charge.maxAmount,
                    chargeType: charge.chargeType,
                    chargeValue: charge.chargeValue,
                    gst: charge.gst,
                    tds: charge.tds,
                    status: "ACTIVE",
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
        log.error("Error updating scheme:", error);

        if (error.code === "23505") {
            error.statusCode = 400;
            error.messageCode = "DUPLICATE_SCHEME_NAME";
            error.message = "A scheme with this name already exists";
        }

        throw error;
    }
}

  async getSchemeById(schemeId) {
    try {
      const query = await db
        .select({
          scheme: schemes,
          charges: schemeCharges,
          api: apiConfigs,
        })
        .from(schemes)
        .leftJoin(
          schemeCharges,
          and(
            eq(schemes.id, schemeCharges.schemeId),
            eq(schemeCharges.status, "ACTIVE")
          )
        )
        .leftJoin(apiConfigs, eq(schemeCharges.apiConfigId, apiConfigs.id))
        .where(eq(schemes.id, schemeId));

      if (!query.length) return null;

      // Group charges and format response
      const formattedScheme = {
        ...query[0].scheme,
        charges: query
          .map((row) =>
            row.charges
              ? {
                  ...row.charges,
                  api: row.api,
                }
              : null
          )
          .filter(Boolean),
      };

      return formattedScheme;
    } catch (error) {
      log.error("Error getting scheme:", error);
      throw error;
    }
  }
  async getSchemes({
    page = 1,
    limit = 10,
    productId = null,
    status = null,
    search = null,
  }) {
    try {
      // Build base query with product information
      let baseQuery = db
        .select({
          scheme: schemes,
          product: products,
          charges: schemeCharges,
          api: apiConfigs,
        })
        .from(schemes)
        .innerJoin(products, eq(schemes.productId, products.id))
        .leftJoin(
          schemeCharges,
          and(
            eq(schemes.id, schemeCharges.schemeId),
            eq(schemeCharges.status, "ACTIVE")
          )
        )
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
        baseQuery.limit(limit).offset(offset).orderBy(desc(schemes.createdAt)),

        db
          .select({
            count: sql`count(distinct ${schemes.id})`,
          })
          .from(schemes)
          .where(conditions.length > 0 ? and(...conditions) : undefined),
      ]);

      // Group charges by scheme
      const groupedSchemes = results.reduce((acc, row) => {
        if (!row.scheme) return acc;

        const existingScheme = acc.find((s) => s.id === row.scheme.id);
        if (existingScheme) {
          if (row.charges) {
            // Check if this charge is already added
            const chargeExists = existingScheme.charges.some(
              (c) => c.id === row.charges.id
            );
            if (!chargeExists) {
              existingScheme.charges.push({
                ...row.charges,
                api: row.api,
              });
            }
          }
        } else {
          acc.push({
            ...row.scheme,
            product: {
              id: row.product.id,
              name: row.product.name,
            },
            charges: row.charges
              ? [
                  {
                    ...row.charges,
                    api: row.api,
                  },
                ]
              : [],
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
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      log.error("Error getting schemes:", error);
      throw error;
    }
  }
  async calculateCharges(amount, schemeId, productId) {
    try {
      const chargeConfigs = await db
        .select()
        .from(schemeCharges)
        .where(
          and(
            eq(schemeCharges.schemeId, schemeId),
            eq(schemeCharges.status, 'ACTIVE')
          )
        )
        .orderBy(asc(schemeCharges.minAmount));
  
      if (!chargeConfigs.length) {
        throw {
          statusCode: 400,
          messageCode: 'NO_CHARGE_CONFIG',
          message: 'No charge configuration found for the scheme'
        };
      }
  
      // Find the applicable charge configuration
      let applicableCharge = null;
      for (const config of chargeConfigs) {
        const minAmount = +config.minAmount || 0;
        const maxAmount = +config.maxAmount || Number.MAX_SAFE_INTEGER;
        
        if (+amount >= +minAmount && +amount <= +maxAmount) {
          applicableCharge = config;
          break;
        }
      }
  
      if (!applicableCharge) {
        throw {
          statusCode: 400,
          messageCode: 'NO_APPLICABLE_CHARGE',
          message: 'No applicable charge configuration found for this amount'
        };
      }
  
      // Calculate base charge
      let chargeAmount;
      if (applicableCharge.chargeType === 'PERCENTAGE') {
        chargeAmount = (+amount * +applicableCharge.chargeValue) / 100;
      } else {
        chargeAmount = +applicableCharge.chargeValue;
      }
  
      // Calculate GST if applicable
      const gstAmount = +applicableCharge.gst 
        ? (+chargeAmount * +applicableCharge.gst) / 100 
        : 0;
  
      // Calculate TDS if applicable
      const tdsAmount = +applicableCharge.tds 
        ? (+chargeAmount * +applicableCharge.tds) / 100 
        : 0;
  
      // Calculate total charges
      const totalCharges = +chargeAmount + +gstAmount;
  
      return {
        charges: {
          chargeType: applicableCharge.chargeType,
          chargeValue: +chargeAmount,
          gst: {
            percentage: +applicableCharge.gst || 0,
            amount: +gstAmount
          },
          tds: +applicableCharge.tds ? {
            percentage: +applicableCharge.tds,
            amount: +tdsAmount
          } : null,
          totalCharges
        }
      };
    } catch (error) {
      console.error('Error calculating charges:', error);
      throw error;
    }
  }
  // async assignSchemeToUser(userId, schemeId, assignedBy) {
  //   try {
  //     return await db.transaction(async (tx) => {
  //       const existingAssignment = await tx
  //         .select()
  //         .from(userSchemes)
  //         .where(
  //           and(
  //             eq(userSchemes.userId, userId),
  //             eq(userSchemes.schemeId, schemeId),
  //             eq(userSchemes.status, "ACTIVE")
  //           )
  //         )
  //         .limit(1);

  //       if (existingAssignment.length > 0) {
  //         const error = new Error("Scheme is already assigned to this user");
  //         error.statusCode = 400;
  //         error.messageCode = "SCHEME_ALREADY_ASSIGNED";
  //         throw error;
  //       }

  //       // Assign new scheme without deactivating existing ones
  //       const [assignment] = await tx
  //         .insert(userSchemes)
  //         .values({
  //           userId,
  //           schemeId,
  //           status: "ACTIVE",
  //           createdBy: assignedBy,
  //         })
  //         .returning();

  //       return assignment;
  //     });
  //   } catch (error) {
  //     log.error("Error assigning scheme to user:", error);
  //     throw error;
  //   }
  // }

  async logSchemeTransaction(transactionData) {
    try {
      const [log] = await db
        .insert(schemeTransactionLogs)
        .values(transactionData)
        .returning();
      return log;
    } catch (error) {
      log.error("Error logging scheme transaction:", error);
      throw error;
    }
  }

  async getUserSchemes(userId, productId = null) {
    try {
      // Build conditions array for better control
      const conditions = [
        eq(userSchemes.userId, userId),
        eq(userSchemes.status, "ACTIVE")
      ];
  
      if (productId) {
        conditions.push(eq(schemes.productId, productId));
      }
  
      let query = db
        .select({
          scheme: schemes,
          assignment: userSchemes,
          charges: schemeCharges,
          api: apiConfigs,
        })
        .from(userSchemes)
        .innerJoin(
          schemes,
          eq(userSchemes.schemeId, schemes.id)
        )
        .leftJoin(
          schemeCharges,
          and(
            eq(schemes.id, schemeCharges.schemeId),
            eq(schemeCharges.status, "ACTIVE")
          )
        )
        .leftJoin(apiConfigs, eq(schemeCharges.apiConfigId, apiConfigs.id))
        .where(and(...conditions)); // Apply all conditions using and()
  
      const results = await query;
  
      // Use Set to track processed schemes
      const processedSchemes = new Set();
      const groupedSchemes = [];
  
      results.forEach((row) => {
        if (!row.scheme || processedSchemes.has(row.scheme.id)) return;
  
        const schemeWithCharges = {
          ...row.scheme,
          assignmentId: row.assignment.id,
          charges: results
            .filter(r => r.scheme.id === row.scheme.id && r.charges)
            .map(r => ({
              ...r.charges,
              api: r.api
            }))
        };
  
        groupedSchemes.push(schemeWithCharges);
        processedSchemes.add(row.scheme.id);
      });
  
      return groupedSchemes;
    } catch (error) {
      log.error("Error getting user schemes:", error);
      throw error;
    }
  }
  
  // async getUsersWithSchemes({
  //   page = 1,
  //   limit = 10,
  //   status = null,
  //   productId = null,
  // }) {
  //   try {
  //     const offset = (page - 1) * limit;

  //     // Build the query with optional filters
  //     let query = db
  //       .select({
  //         user: {
  //           id: users.id,
  //           username: users.username,
  //           firstname: users.firstname,
  //           lastname: users.lastname,
  //           emailId: users.emailId,
  //           phoneNo: users.phoneNo,
  //           isActive: users.isActive,
  //         },
  //         schemeDetails: sql`
  //                       COALESCE(
  //                           json_agg(
  //                               DISTINCT jsonb_build_object(
  //                                   'schemeId', ${schemes.id},
  //                                   'schemeName', ${schemes.name},
  //                                   'status', ${userSchemes.status},
  //                                   'assignedAt', ${userSchemes.createdAt},
  //                                   'product', jsonb_build_object(
  //                                       'id', ${products.id},
  //                                       'name', ${products.name}
  //                                   )
  //                               )
  //                           ) FILTER (WHERE ${schemes.id} IS NOT NULL),
  //                           '[]'
  //                       )
  //                   `.as("schemeDetails"),
  //       })
  //       .from(users)
  //       .leftJoin(userSchemes, eq(users.id, userSchemes.userId))
  //       .leftJoin(schemes, eq(userSchemes.schemeId, schemes.id))
  //       .leftJoin(products, eq(schemes.productId, products.id));

  //     // Apply filters
  //     if (status) {
  //       query = query.where(eq(userSchemes.status, status));
  //     }

  //     if (productId) {
  //       query = query.where(eq(products.id, productId));
  //     }

  //     // Add grouping
  //     query = query
  //       .groupBy(users.id)
  //       .orderBy(desc(users.createdAt))
  //       .limit(limit)
  //       .offset(offset);

  //     // Execute main query
  //     const usersData = await query;

  //     // Get total count
  //     const [{ count }] = await db
  //       .select({
  //         count: sql`COUNT(DISTINCT ${users.id})`,
  //       })
  //       .from(users)
  //       .leftJoin(userSchemes, eq(users.id, userSchemes.userId))
  //       .leftJoin(schemes, eq(userSchemes.schemeId, schemes.id))
  //       .leftJoin(products, eq(schemes.productId, products.id))
  //       .where(query.where);

  //     // Process the results
  //     const processedUsers = usersData.map((userData) => ({
  //       ...userData.user,
  //       schemes: userData.schemeDetails,
  //       schemeStatus:
  //         userData.schemeDetails.length > 0 ? "ASSIGNED" : "NOT_ASSIGNED",
  //     }));

  //     return {
  //       data: processedUsers,
  //       pagination: {
  //         page,
  //         limit,
  //         total: Number(count),
  //         pages: Math.ceil(Number(count) / limit),
  //       },
  //     };
  //   } catch (error) {
  //     log.error("Error getting users with schemes:", error);
  //     throw error;
  //   }
  // }

  async assignSchemeToUser(userId, schemeId, assignedBy) {
    try {
      return await db.transaction(async (tx) => {
        // Get the scheme details to check product
        const [scheme] = await tx
          .select()
          .from(schemes)
          .where(eq(schemes.id, schemeId))
          .limit(1);
  
        if (!scheme) {
          const error = new Error("Scheme not found");
          error.statusCode = 404;
          error.messageCode = "SCHEME_NOT_FOUND";
          throw error;
        }
  
        // Check if user already has a scheme for this product
        const existingAssignment = await tx
          .select({
            userScheme: userSchemes,
            scheme: schemes,
          })
          .from(userSchemes)
          .innerJoin(schemes, eq(userSchemes.schemeId, schemes.id))
          .where(
            and(
              eq(userSchemes.userId, userId),
              eq(schemes.productId, scheme.productId),
              eq(userSchemes.status, "ACTIVE")
            )
          )
          .limit(1);
  
        if (existingAssignment.length > 0) {
          // Deactivate existing scheme for this product
          await tx
            .update(userSchemes)
            .set({
              status: "INACTIVE",
              updatedAt: new Date()
            })
            .where(eq(userSchemes.id, existingAssignment[0].userScheme.id));
        }
  
        // Assign new scheme
        const [assignment] = await tx
          .insert(userSchemes)
          .values({
            userId,
            schemeId,
            status: "ACTIVE",
            createdBy: assignedBy,
          })
          .returning();
  
        return assignment;
      });
    } catch (error) {
      log.error("Error assigning scheme to user:", error);
      throw error;
    }
  }
  
  async getUsersWithSchemes({
    page = 1,
    limit = 10,
    status = null,
    productId = null,
  }) {
    try {
      const offset = (page - 1) * limit;
  
      let query = db
        .select({
          user: {
            id: users.id,
            username: users.username,
            firstname: users.firstname,
            lastname: users.lastname,
            emailId: users.emailId,
            phoneNo: users.phoneNo,
            isActive: users.isActive,
          },
          schemeDetails: sql`
            json_agg(
              DISTINCT jsonb_build_object(
                'schemeId', ${schemes.id},
                'schemeName', ${schemes.name},
                'status', ${userSchemes.status},
                'assignedAt', ${userSchemes.createdAt},
                'product', jsonb_build_object(
                  'id', ${products.id},
                  'name', ${products.name}
                ),
                'charges', (
                  SELECT json_agg(
                    jsonb_build_object(
                      'id', sc.id,
                      'minAmount', sc.minAmount,
                      'maxAmount', sc.maxAmount,
                      'chargeType', sc.chargeType,
                      'chargeValue', sc.chargeValue,
                      'gst', sc.gst,
                      'tds', sc.tds
                    )
                  )
                  FROM scheme_charges sc
                  WHERE sc.schemeId = ${schemes.id}
                  AND sc.status = 'ACTIVE'
                )
              )
            ) FILTER (WHERE ${schemes.id} IS NOT NULL AND ${userSchemes.status} = 'ACTIVE')
          `.as("schemeDetails"),
        })
        .from(users)
        .leftJoin(userSchemes, eq(users.id, userSchemes.userId))
        .leftJoin(schemes, eq(userSchemes.schemeId, schemes.id))
        .leftJoin(products, eq(schemes.productId, products.id));
  
      if (status) {
        query = query.where(eq(userSchemes.status, status));
      }
  
      if (productId) {
        query = query.where(eq(products.id, productId));
      }
  
      query = query
        .groupBy(users.id)
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset);
  
      const usersData = await query;
  
      const processedUsers = usersData.map((userData) => ({
        ...userData.user,
        schemes: userData.schemeDetails || [],
        schemesByProduct: (userData.schemeDetails || []).reduce((acc, scheme) => {
          if (!acc[scheme.product.id]) {
            acc[scheme.product.id] = {
              productId: scheme.product.id,
              productName: scheme.product.name,
              scheme: scheme
            };
          }
          return acc;
        }, {}),
        schemeStatus: userData.schemeDetails?.length > 0 ? "ASSIGNED" : "NOT_ASSIGNED",
      }));
  
      const [{ count }] = await db
        .select({
          count: sql`COUNT(DISTINCT ${users.id})`,
        })
        .from(users)
        .leftJoin(userSchemes, eq(users.id, userSchemes.userId))
        .leftJoin(schemes, eq(userSchemes.schemeId, schemes.id))
        .leftJoin(products, eq(schemes.productId, products.id))
        .where(query.where);
  
      return {
        data: processedUsers,
        pagination: {
          page,
          limit,
          total: Number(count),
          pages: Math.ceil(Number(count) / limit),
        },
      };
    } catch (error) {
      log.error("Error getting users with schemes:", error);
      throw error;
    }
  }
}

module.exports = new SchemeDao();
