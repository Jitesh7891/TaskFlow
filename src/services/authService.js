const jwt = require('jsonwebtoken');
const { User } = require('../models');
const AppError = require('../utils/AppError');

class AuthService {
    // Generate JWT token
    generateToken(userId) {
        return jwt.sign(
            { userId },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );
    }

    // Register new user
    async register({ name, email, password }) {
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            throw new AppError('Email already registered', 409);
        }

        // Create user (password will be hashed by pre-save hook)
        const user = await User.create({
            name,
            email,
            passwordHash: password,
        });

        const token = this.generateToken(user._id);

        return {
            user: user.toJSON(),
            token,
        };
    }

    // Login user
    async login({ email, password }) {
        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            throw new AppError('Invalid email or password', 401);
        }

        // Compare password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            throw new AppError('Invalid email or password', 401);
        }

        const token = this.generateToken(user._id);

        return {
            user: user.toJSON(),
            token,
        };
    }

    // Get all users
    async getAllUsers() {
        return User.find({}, 'name email').sort({ name: 1 });
    }
}

module.exports = new AuthService();
