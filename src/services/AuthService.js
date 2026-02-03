const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');

const AuthService = {

    async verifyUser(email, password) {
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            throw new Error('USER_NOT_FOUND');
        }

        const senhaBate = await bcrypt.compare(password, user.password);

        if (!senhaBate) {
            throw new Error('INCORRECT_PASSWORD');
        }

        return user;
    },

    async getAllUsers() {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true
            }
        });
        return users;
    },

    async getUserById(id) {
        const user = await prisma.user.findUnique({
            where: { id: Number(id) },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true
            }
        });
        return user;
    },

    async createUser(name, email, passwordRaw, role) {
        const userExists = await prisma.user.findUnique({ where: { email } });

        if (userExists) throw new Error('EMAIL_ALREADY_EXISTS');

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(passwordRaw, salt);

        const newUser = await prisma.user.create({
            data: {
                name,
                email,
                password: passwordHash,
                role
            }
        });
        return newUser;
    },

    async updateUser(id, name, email, role, passwordRaw) {

        const userExists = await prisma.user.findUnique({ where: { id: Number(id) } });
        if (!userExists) throw new Error('USER_NOT_FOUND');

        const dadosParaAtualizar = {};

        if (name) dadosParaAtualizar.name = name;
        if (email) dadosParaAtualizar.email = email;
        if (role) dadosParaAtualizar.role = role;

        if (passwordRaw) {
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(passwordRaw, salt);
            dadosParaAtualizar.password = passwordHash;
        }

        if (Object.keys(dadosParaAtualizar).length === 0) {
            return userExists;
        }
        const updatedUser = await prisma.user.update({
            where: { id: Number(id) },
            data: dadosParaAtualizar
        });

        return updatedUser;
    },

    async deleteUser(id) {
        try {
            const deletedUser = await prisma.user.delete({
                where: { id: Number(id) }
            });
            return deletedUser;
        } catch (error) {
            if (error.code === 'P2025') {
                return null;
            }
            throw error;
        }
    }
}

module.exports = AuthService;