const Logger = require('../logger/logger');
const log = new Logger('Product-Dao');
const { db, products } = require('./db/schema');
const { eq, and, like,sql } = require('drizzle-orm');

class ProductDao {
    async createProduct(name) {
        try {
            const [product] = await db
                .insert(products)
                .values({ name })
                .returning();
            return product;
        } catch (error) {
            log.error('Error creating product:', error);
            throw error;
        }
    }

    async updateProduct(id, { name, isActive }) {
        try {
            const [product] = await db
                .update(products)
                .set({
                    name,
                    isActive,
                    updatedAt: new Date()
                })
                .where(eq(products.id, id))
                .returning();
            return product;
        } catch (error) {
            log.error('Error updating product:', error);
            throw error;
        }
    }

    async getProductById(id) {
        try {
            const [product] = await db
                .select()
                .from(products)
                .where(eq(products.id, id))
                .limit(1);
            return product;
        } catch (error) {
            log.error('Error getting product:', error);
            throw error;
        }
    }

    async getProducts({ page = 1, limit = 10, search = null }) {
        try {
            let query = db.select().from(products);

            if (search) {
                query = query.where(like(products.name, `%${search}%`));
            }

            const offset = (page - 1) * limit;
            const [productList, countResult] = await Promise.all([
                query.limit(limit).offset(offset),
                db.select({ count: sql`count(*)` }).from(products)
            ]);

            return {
                data: productList,
                pagination: {
                    page,
                    limit,
                    total: countResult[0].count,
                    pages: Math.ceil(countResult[0].count / limit)
                }
            };
        } catch (error) {
            log.error('Error getting products:', error);
            throw error;
        }
    }

    async deleteProduct(id) {
        try {
            const [product] = await db
                .delete(products)
                .where(eq(products.id, id))
                .returning();
            return product;
        } catch (error) {
            log.error('Error deleting product:', error);
            throw error;
        }
    }
}

module.exports = new ProductDao();