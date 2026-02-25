const AuthService = require('../services/AuthService');
const jwt = require('jsonwebtoken');

exports.verifyLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'E-mail e senha são obrigatórios'
            });
        }

        const user = await AuthService.verifyUser(email, password);
        const token = jwt.sign(
            {
                id: user.id,
                role: user.role,
                email: user.email
            },
            process.env.JWT_SECRET,
            {
                expiresIn: '3h'
            }
        );

        return res.status(200).json({
            success: true,
            message: 'Login realizado com sucesso',
            token: token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        if (error.message === 'USER_NOT_FOUND') {
            return res.status(404).json({
                success: false,
                error: 'Usuário não encontrado'
            });
        }
        if (error.message === 'INCORRECT_PASSWORD') {
            return res.status(401).json({
                success: false,
                error: 'Senha incorreta'
            });
        }
        console.error("Internal error:", error);
        return res.status(500).json({
            success: false,
            error: 'Erro interno no servidor'
        });
    }
};

exports.getUsers = async (req, res) => {
    try {
        const users = await AuthService.getAllUsers();
        return res.status(200).json(users);
    } catch (error) {
        return res.status(500).json({ error: 'Erro ao buscar usuários' });
    }
};

exports.createUser = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({ success: false, error: 'Preencha todos os campos obrigatórios.' });
        }

        const newUser = await AuthService.createUser(name, email, password, role);

        const token = jwt.sign(
            {
                id: newUser.id,
                role: newUser.role,
                email: newUser.email
            },
            process.env.JWT_SECRET,
            {
                expiresIn: '3h'
            }
        );

        return res.status(201).json({
            success: true,
            message: 'Usuário criado com sucesso!',
            token: token,
            data: {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role
            }
        });
    } catch (error) {
        if (error.message === 'EMAIL_ALREADY_EXISTS') {
            return res.status(409).json({
                success: false,
                error: 'Este e-mail já está cadastrado.'
            });
        }
        return res.status(500).json({ success: false, error: 'Erro ao criar usuário', details: error.message });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const { id, name, email, role, password } = req.body;

        if (!id) return res.status(400).json({ error: 'User ID is required.' });

        const updatedUser = await AuthService.updateUser(id, name, email, role, password);

        if (!updatedUser) return res.status(404).json({ error: 'User not found.' });

        return res.status(200).json({ message: 'Updated successfully!', data: updatedUser });
    } catch (error) {
        return res.status(500).json({ error: 'Error updating user' });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.body;

        if (!id) return res.status(400).json({ error: 'User ID is required.' });

        const deletedUser = await AuthService.deleteUser(id);

        if (!deletedUser) return res.status(404).json({ error: 'User not found.' });

        return res.status(200).json({ message: 'Deleted successfully!', data: deletedUser });
    } catch (error) {
        return res.status(500).json({ error: 'Error deleting user' });
    }
};

exports.validateTokenByQuery = async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(401).json({ valid: false, error: 'Token não fornecido' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await AuthService.getUserById(decoded.id);

        if (!user) {
            return res.status(401).json({ valid: false, error: 'Usuário não encontrado' });
        }

        return res.status(200).json({
            valid: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        return res.status(401).json({
            valid: false,
            error: 'Token inválido ou expirado',
            details: error.message
        });
    }
};

exports.validateSSO = async (req, res) => {
    try {
        const { token } = req.body;

        // Validate input
        if (!token) {
            return res.status(400).json({
                success: false,
                error: 'Token não fornecido'
            });
        }

        // Validate SSO token signature and claims
        const decoded = await AuthService.validateSSOToken(token);

        // Extract email from payload
        const email = decoded.email;

        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email não encontrado no token'
            });
        }

        // Find user in local database
        const user = await AuthService.getUserByEmail(email);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Usuário não cadastrado neste sistema'
            });
        }

        // Generate our own session token
        const sessionToken = jwt.sign(
            {
                id: user.id,
                role: user.role,
                email: user.email
            },
            process.env.JWT_SECRET,
            {
                expiresIn: '3h'
            }
        );

        // Return successful authentication
        return res.status(200).json({
            success: true,
            message: 'Autenticação SSO realizada com sucesso',
            token: sessionToken,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        // Handle specific errors
        if (error.message === 'INVALID_SSO_TOKEN') {
            return res.status(401).json({
                success: false,
                error: 'Token SSO inválido ou expirado'
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                error: 'Token SSO malformado'
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Token SSO expirado'
            });
        }

        // Generic error handler
        console.error('SSO Validation Error:', error);
        return res.status(500).json({
            success: false,
            error: 'Erro interno ao validar SSO'
        });
    }
};
