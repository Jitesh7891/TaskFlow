const { authService } = require('../services');
const { registerSchema, loginSchema } = require('../utils/validators');

// Register new user
const register = async (req, res, next) => {
    try {
        const validatedData = registerSchema.parse(req.body);
        const result = await authService.register(validatedData);

        res.status(201).json({
            status: 'success',
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

// Login user
const login = async (req, res, next) => {
    try {
        const validatedData = loginSchema.parse(req.body);
        const result = await authService.login(validatedData);

        res.status(200).json({
            status: 'success',
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

// Get all users (for assignment)
const getUsers = async (req, res, next) => {
    try {
        const users = await authService.getAllUsers();
        res.status(200).json({
            status: 'success',
            data: { users },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    register,
    login,
    getUsers,
};
