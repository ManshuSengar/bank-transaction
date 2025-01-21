// telegram-service/telegram-dao.js
const axios = require('axios');
const Logger = require('../logger/logger');
const log = new Logger('Telegram-Service');

class TelegramDao {
    constructor() {
        this.botToken = process.env.TELEGRAM_BOT_TOKEN;
        this.chatId = process.env.TELEGRAM_CHAT_ID;
        this.apiUrl = `https://api.telegram.org/bot${this.botToken}`;
    }

    async sendFundRequestNotification(requestData) {
        try {
            const message = this.formatFundRequestMessage(requestData);
            await this.sendMessage(message);
            log.info(`Fund request notification sent successfully for request ID: ${requestData.id}`);
            return true;
        } catch (error) {
            console.log("error--> ",error);
            log.error('Error sending fund request notification:', error);
            return false;
        }
    }

    formatFundRequestMessage(request) {
        const status = request.status.charAt(0).toUpperCase() + request.status.slice(1).toLowerCase();
        const amount = parseFloat(request.amount).toLocaleString('en-IN', {
            style: 'currency',
            currency: 'INR'
        });

        let message = `🔔 *New Fund Request*\n\n`;
        message += `*Request ID:* ${request.id}\n`;
        message += `*User:* ${request.user.firstname} ${request.user.lastname}\n`;
        message += `*Amount:* ${amount}\n`;
        message += `*Status:* ${status}\n`;
        message += `*Transfer Type:* ${request.transferType}\n`;
        message += `*Payment Mode:* ${request.paymentMode}\n`;
        message += `*Reference Number:* ${request.referenceNumber}\n`;
        message += `*Created At:* ${new Date(request.createdAt).toLocaleString()}\n`;

        if (request.remarks) {
            message += `*Remarks:* ${request.remarks}\n`;
        }

        return message;
    }

    async sendMessage(text) {
        try {
            await axios.post(`${this.apiUrl}/sendMessage`, {
                chat_id: this.chatId,
                text: text,
                parse_mode: 'Markdown'
            });
        } catch (error) {
            log.error('Error sending Telegram message:', error);
            throw error;
        }
    }
}

module.exports = new TelegramDao();