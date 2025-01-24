const axios = require('axios');
const crypto = require('crypto');
const config = require('config');
const Logger = require('../logger/logger');
const log = new Logger('Encryption-Service');

class EncryptionDao {
    constructor() {
        this.baseUrl =process.env.VENDOR_API;
        this.bearerToken = process.env.VENDOR_API_KEY;
        this.resellerId = process.env.RESELLER_ID; 
    }

    async encrypt(data) {
        try {
            const response = await axios.post(
                this.baseUrl,
                {
                    resid: this.resellerId,
                    task: 'enc',
                    data: data
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.bearerToken}`,
                        'Cookie': 'SRVNAME=S1'
                    }
                }
            );

            return response.data;
        } catch (error) {
            log.error('Encryption error:', error);
            throw new Error('Failed to encrypt data');
        }
    }

    async decrypt(encryptedData) {
        try {
            const response = await axios.post(
                this.baseUrl,
                {
                    resid: this.resellerId,
                    task: 'dec',
                    data: encryptedData
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.bearerToken}`,
                        'Cookie': 'SRVNAME=S1'
                    }
                }
            );
            console.log("encryptedData--> ",response);
            return response.data;
        } catch (error) {
            console.log("error",error);
            log.error('Decryption error:', error);
            throw new Error('Failed to decrypt data');
        }
    }

    generateSecureKey(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }

    customEncrypt(data, secretKey) {
        try {
            const iv = crypto.randomBytes(16);
            
            const cipher = crypto.createCipheriv(
                'aes-256-cbc', 
                Buffer.from(secretKey, 'hex'), 
                iv
            );

            let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'base64');
            encrypted += cipher.final('base64');

            return {
                iv: iv.toString('base64'),
                encryptedData: encrypted
            };
        } catch (error) {
            log.error('Custom encryption error:', error);
            throw new Error('Failed to perform custom encryption');
        }
    }

    customDecrypt(encryptedPayload, secretKey) {
        try {
            const iv = Buffer.from(encryptedPayload.iv, 'base64');
            
            const decipher = crypto.createDecipheriv(
                'aes-256-cbc', 
                Buffer.from(secretKey, 'hex'), 
                iv
            );

            let decrypted = decipher.update(encryptedPayload.encryptedData, 'base64', 'utf8');
            decrypted += decipher.final('utf8');

            return JSON.parse(decrypted);
        } catch (error) {
            log.error('Custom decryption error:', error);
            throw new Error('Failed to perform custom decryption');
        }
    }
}

module.exports = new EncryptionDao();