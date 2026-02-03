const AuthService = require('../services/AuthService');
const jwt = require('jsonwebtoken');

exports.verifyLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

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
            console.error("User not found");
            return res.status(401).json({
                success: false,
                error: 'User not found',
                code: '401'
            });
        }
        if (error.message === 'INCORRECT_PASSWORD') {
            console.error("Incorrect password");
            return res.status(401).json({
                success: false,
                error: 'Incorrect password',
                code: '401'
            });
        }
        console.error("Internal error:", error);
        return res.status(500).json({
            success: false,
            error: 'Internal error in the server'
        });
    }
};

exports.getUsers = async (req, res) => {
    try {
        const users = await AuthService.getAllUsers();
        return res.status(200).json(users);
    } catch (error) {
        return res.status(500).json({ error: 'Error when searching for users' });
    }
};

exports.createUser = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Missing required fields.' });
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
            message: 'User created!',
            token: token,
            data: {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role
            }
        });
    } catch (error) {
        return res.status(500).json({ "error creating user": error.message });
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

        // Busca dados atualizados do usuário, pois o token pode ter dados antigos
        // Vamos usar o prisma diretamente aqui ou criar um metodo no service se precisar
        // Como o AuthService ja tem getAllUsers, vamos fazer uma busca manual ou adaptar
        // Na verdade, o decoded tem o ID. Vou buscar no AuthService.
        // O AuthService não tem um getById publico, mas tem verifyUser.
        // Vou usar o prisma do AuthService importado indiretamente ou fazer a query aqui se tiver acesso.
        // O controller não tem acesso direto ao prisma, vou chamar AuthService.getUserById(decoded.id)
        // Preciso criar esse metodo no AuthService primeiro? Sim. Mas vou tentar usar o que tenho.
        // O update user faz busca por ID. Vou adicionar um getUserById no AuthService depois.
        // Por hora, vou assumir que posso adicionar getUserById no AuthService e chamar aqui.

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