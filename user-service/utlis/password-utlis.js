// utils/password-utils.js
const crypto = require('crypto');

function generateRandomPassword(length = 12) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    
    // Ensure at least one of each required character type
    password += getRandomChar('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    password += getRandomChar('abcdefghijklmnopqrstuvwxyz');
    password += getRandomChar('0123456789');
    password += getRandomChar('!@#$%^&*');
    
    // Fill the rest of the password
    while (password.length < length) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    // Shuffle the password
    return password.split('').sort(() => 0.5 - Math.random()).join('');
}

function getRandomChar(charset) {
    return charset.charAt(Math.floor(Math.random() * charset.length));
}

module.exports = {
    generateRandomPassword
};