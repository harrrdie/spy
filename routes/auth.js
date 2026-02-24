const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database');

const router = express.Router();

// Регистрация
router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Логин и пароль обязательны' });
        }

        if (username.length < 3 || username.length > 20) {
            return res.status(400).json({ error: 'Логин должен быть от 3 до 20 символов' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
        }

        const existingUser = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(username);
        if (existingUser) {
            return res.status(400).json({ error: 'Пользователь с таким логином уже существует' });
        }

        const password_hash = await bcrypt.hash(password, 10);
        
        const result = db.prepare(`
            INSERT INTO users (username, password_hash, display_name, avatar_seed)
            VALUES (?, ?, ?, ?)
        `).run(username, password_hash, username, username + Date.now());

        const userId = result.lastInsertRowid;
        
        db.prepare('INSERT INTO user_stats (user_id, rating) VALUES (?, 0)').run(userId);

        req.session.userId = userId;
        req.session.username = username;

        res.json({
            success: true,
            user: {
                id: userId,
                username: username,
                display_name: username
            }
        });
    } catch (err) {
        console.error('Ошибка регистрации:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Вход
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Введите логин и пароль' });
        }

        const user = db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?) AND deleted_at IS NULL').get(username);
        if (!user) {
            return res.status(401).json({ error: 'Неверный логин или пароль' });
        }

        if (user.is_banned) {
            const reason = user.ban_reason && user.ban_reason.trim().length > 0
                ? `Аккаунт заблокирован: ${user.ban_reason}`
                : 'Аккаунт заблокирован. Обратитесь к администратору.';
            return res.status(403).json({ error: reason });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Неверный логин или пароль' });
        }

        req.session.userId = user.id;
        req.session.username = user.username;

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                display_name: user.display_name || user.username
            }
        });
    } catch (err) {
        console.error('Ошибка входа:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Выход
router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Смена пароля
router.put('/password', async (req, res) => {
    try {
        if (!req.session.userId) return res.status(401).json({ error: 'Войдите в аккаунт' });
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Укажите текущий и новый пароль' });
        if (newPassword.length < 6) return res.status(400).json({ error: 'Новый пароль не менее 6 символов' });
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
        if (!user) return res.status(401).json({ error: 'Сессия недействительна' });
        const valid = await bcrypt.compare(currentPassword, user.password_hash);
        if (!valid) return res.status(400).json({ error: 'Неверный текущий пароль' });
        const password_hash = await bcrypt.hash(newPassword, 10);
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(password_hash, req.session.userId);
        res.json({ success: true });
    } catch (err) {
        console.error('Ошибка смены пароля:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Проверка текущего пользователя
router.get('/me', (req, res) => {
    if (!req.session.userId) {
        return res.json({ user: null });
    }

    const user = db.prepare('SELECT id, username, display_name, avatar_seed, is_admin, is_banned, deleted_at FROM users WHERE id = ?').get(req.session.userId);
    if (!user) {
        req.session.destroy();
        return res.json({ user: null });
    }

    if (user.deleted_at || user.is_banned) {
        req.session.destroy();
        return res.json({ user: null });
    }

    const stats = db.prepare('SELECT * FROM user_stats WHERE user_id = ?').get(user.id);

    res.json({
        user: {
            id: user.id,
            username: user.username,
            display_name: user.display_name || user.username,
            avatar_seed: user.avatar_seed || user.username,
            stats: stats || { games_played: 0, games_won_as_spy: 0, games_won_as_civilian: 0, games_lost: 0 },
            is_admin: !!user.is_admin
        }
    });
});

module.exports = router;
