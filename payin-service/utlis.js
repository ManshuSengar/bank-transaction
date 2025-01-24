const indianNameData = {
    firstNames: [
      'Aarav', 'Arjun', 'Advait', 'Bharat', 'Dev', 'Dhruv', 'Ishaan', 'Krishna',
      'Aanya', 'Diya', 'Ishita', 'Kavya', 'Mira', 'Neha', 'Priya', 'Riya',
      'Kabir', 'Lakshya', 'Mohan', 'Neel', 'Om', 'Pranav', 'Reyansh', 'Rohan',
      'Saanvi', 'Sahana', 'Shakti', 'Shyla', 'Tara', 'Uma', 'Veda', 'Zara'
    ],
    lastNames: [
      'Patel', 'Kumar', 'Singh', 'Shah', 'Sharma', 'Verma', 'Gupta', 'Desai',
      'Kapoor', 'Malhotra', 'Mehra', 'Reddy', 'Chopra', 'Joshi', 'Mehta', 'Rao',
      'Chauhan', 'Yadav', 'Tiwari', 'Raj', 'Mishra', 'Iyer', 'Acharya', 'Nair'
    ],
    domains: [
      'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'
    ]
  };
  
  class IndianNameEmailGenerator {
    constructor() {
      this.usedEmails = new Set();
      this.nameData = indianNameData;
    }
  
    #getRandomElement(array) {
      return array[Math.floor(Math.random() * array.length)];
    }
  
    #generateRandomNumber(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }
  
    #sanitizeForEmail(text) {
      return text.toLowerCase().replace(/[^a-z0-9]/g, '');
    }
  
    #generateBaseEmail(firstName, lastName) {
      const patterns = [
        () => `${this.#sanitizeForEmail(firstName)}.${this.#sanitizeForEmail(lastName)}`,
        () => `${this.#sanitizeForEmail(firstName)}${this.#generateRandomNumber(1, 999)}`,
        () => `${this.#sanitizeForEmail(firstName[0])}${this.#sanitizeForEmail(lastName)}`,
        () => `${this.#sanitizeForEmail(firstName)}${this.#sanitizeForEmail(lastName)}${this.#generateRandomNumber(1, 99)}`
      ];
  
      return this.#getRandomElement(patterns)();
    }
  
    generateUniqueNameEmail() {
      let attempts = 0;
      const maxAttempts = 100;
  
      while (attempts < maxAttempts) {
        const firstName = this.#getRandomElement(this.nameData.firstNames);
        const lastName = this.#getRandomElement(this.nameData.lastNames);
        const domain = this.#getRandomElement(this.nameData.domains);
        
        const baseEmail = this.#generateBaseEmail(firstName, lastName);
        const fullEmail = `${baseEmail}@${domain}`;
  
        if (!this.usedEmails.has(fullEmail)) {
          this.usedEmails.add(fullEmail);
          return {
            firstName,
            lastName,
            fullName: `${firstName} ${lastName}`,
            email: fullEmail
          };
        }
  
        attempts++;
      }
  
      throw new Error('Unable to generate unique email after maximum attempts');
    }
  
    clearUsedEmails() {
      this.usedEmails.clear();
    }
  }
  
  module.exports=IndianNameEmailGenerator;