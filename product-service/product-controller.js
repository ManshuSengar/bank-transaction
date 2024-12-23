const express = require('express');
const productRouter = express.Router();
const productDao = require('./product-dao');
const Logger = require('../logger/logger');
const log = new Logger('Product-Controller');
const { authenticateToken } = require('../middleware/auth-token-validator');
const Joi = require('joi');

// Validation schema
const productSchema = Joi.object({
    name: Joi.string().min(3).max(100).required(),
    isActive: Joi.boolean().default(true)
});

// Create product
productRouter.post('/', 
    authenticateToken,
    async (req, res) => {
        try {
            const { error } = productSchema.validate(req.body);
            if (error) {
                return res.status(400).send({
                    messageCode: 'VALIDATION_ERROR',
                    message: error.details[0].message
                });
            }

            const product = await productDao.createProduct(req.body.name);

            res.status(201).send({
                messageCode: 'PRODUCT_CREATED',
                message: 'Product created successfully',
                product
            });
        } catch (error) {
            log.error('Error creating product:', error);
            res.status(500).send({
                messageCode: 'ERR_PRODUCT_CREATE',
                message: 'Error creating product'
            });
        }
});

// Update product
productRouter.put('/:id',
    authenticateToken,
    async (req, res) => {
        try {
            const { error } = productSchema.validate(req.body);
            if (error) {
                return res.status(400).send({
                    messageCode: 'VALIDATION_ERROR',
                    message: error.details[0].message
                });
            }

            const product = await productDao.updateProduct(req.params.id, req.body);

            if (!product) {
                return res.status(404).send({
                    messageCode: 'PRODUCT_NOT_FOUND',
                    message: 'Product not found'
                });
            }

            res.send({
                messageCode: 'PRODUCT_UPDATED',
                message: 'Product updated successfully',
                product
            });
        } catch (error) {
            log.error('Error updating product:', error);
            res.status(500).send({
                messageCode: 'ERR_PRODUCT_UPDATE',
                message: 'Error updating product'
            });
        }
});

// Get product by id
productRouter.get('/:id',
    authenticateToken,
    async (req, res) => {
        try {
            const product = await productDao.getProductById(req.params.id);
            
            if (!product) {
                return res.status(404).send({
                    messageCode: 'PRODUCT_NOT_FOUND',
                    message: 'Product not found'
                });
            }

            res.send({
                messageCode: 'PRODUCT_FETCHED',
                message: 'Product retrieved successfully',
                product
            });
        } catch (error) {
            log.error('Error getting product:', error);
            res.status(500).send({
                messageCode: 'ERR_PRODUCT_GET',
                message: 'Error retrieving product'
            });
        }
});

// Get all products with pagination
productRouter.get('/',
    authenticateToken,
    async (req, res) => {
        try {
            const { page, limit, search } = req.query;
            const products = await productDao.getProducts({
                page: parseInt(page),
                limit: parseInt(limit),
                search
            });

            res.send({
                messageCode: 'PRODUCTS_FETCHED',
                message: 'Products retrieved successfully',
                ...products
            });
        } catch (error) {
            log.error('Error getting products:', error);
            res.status(500).send({
                messageCode: 'ERR_PRODUCTS_GET',
                message: 'Error retrieving products'
            });
        }
});

// Delete product
productRouter.delete('/:id',
    authenticateToken,
    async (req, res) => {
        try {
            const product = await productDao.deleteProduct(req.params.id);
            
            if (!product) {
                return res.status(404).send({
                    messageCode: 'PRODUCT_NOT_FOUND',
                    message: 'Product not found'
                });
            }

            res.send({
                messageCode: 'PRODUCT_DELETED',
                message: 'Product deleted successfully'
            });
        } catch (error) {
            log.error('Error deleting product:', error);
            res.status(500).send({
                messageCode: 'ERR_PRODUCT_DELETE',
                message: 'Error deleting product'
            });
        }
});

module.exports = productRouter;