const express = require('express');
const db = require('../database');
const { checkAndGrantAchievements } = require('../achievements');

const router = express.Router();

// Поиск пользователей по юзернейму
router.get('/search', (req, res) => {
    try {
        const q = (req.query.q || '').trim();
        if (q.length < 2) {
            return res.json({ users: [] });
        }
        const users = db.prepare(`
            SELECT id, username, display_name, avatar_seed
            FROM users
            WHERE username LIKE ? OR display_name LIKE ?
            ORDER BY username
            LIMIT 20
        `).all('%' + q + '%', '%' + q + '%');
        res.json({
            users: users.map(u => ({
                id: u.id,
                username: u.username,
                display_name: u.display_name || u.username,
                avatar_seed: u.avatar_seed || u.username
            }))
        });
    } catch (err) {
        console.error('Ошибка поиска:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Список уведомлений (до /:id)
router.get('/notifications/list', (req, res) => {
    try {
        if (!req.session.userId) return res.status(401).json({ error: 'Войдите в аккаунт' });
        const list = db.prepare(`
            SELECT n.id, n.type, n.data, n.read_at, n.created_at
            FROM notifications n
            WHERE n.user_id = ?
            ORDER BY n.created_at DESC
            LIMIT 100
        `).all(req.session.userId);
        const withNames = list.map(n => {
            const data = n.data ? JSON.parse(n.data) : {};
            let fromName = null;
            if (data.from_user_id) {
                const u = db.prepare('SELECT username, display_name FROM users WHERE id = ?').get(data.from_user_id);
                fromName = u ? (u.display_name || u.username) : null;
            }
            return { id: n.id, type: n.type, data: data, read_at: n.read_at, created_at: n.created_at, from_name: fromName };
        });
        res.json({ notifications: withNames });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Отметить уведомление прочитанным
router.patch('/notifications/:id/read', (req, res) => {
    try {
        if (!req.session.userId) return res.status(401).json({ error: 'Войдите в аккаунт' });
        const id = parseInt(req.params.id);
        db.prepare('UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?').run(id, req.session.userId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Удалить уведомление
router.delete('/notifications/:id', (req, res) => {
    try {
        if (!req.session.userId) return res.status(401).json({ error: 'Войдите в аккаунт' });
        const id = parseInt(req.params.id);
        db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?').run(id, req.session.userId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Удалить все уведомления
router.delete('/notifications', (req, res) => {
    try {
        if (!req.session.userId) return res.status(401).json({ error: 'Войдите в аккаунт' });
        db.prepare('DELETE FROM notifications WHERE user_id = ?').run(req.session.userId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить профиль пользователя
router.get('/:id', (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        
        const user = db.prepare(`
            SELECT id, username, display_name, avatar_seed, created_at 
            FROM users WHERE id = ?
        `).get(userId);

        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        const stats = db.prepare('SELECT * FROM user_stats WHERE user_id = ?').get(userId);
        
        const comments = db.prepare(`
            SELECT c.id, c.text, c.created_at, u.username as author_name, u.display_name as author_display_name, u.id as author_id
            FROM profile_comments c
            JOIN users u ON c.author_user_id = u.id
            WHERE c.profile_user_id = ?
            ORDER BY c.created_at DESC
            LIMIT 50
        `).all(userId);

        const likeCount = db.prepare('SELECT COUNT(*) as c FROM profile_likes WHERE profile_user_id = ?').get(userId).c;
        const isLiked = req.session.userId 
            ? db.prepare('SELECT 1 FROM profile_likes WHERE profile_user_id = ? AND liker_user_id = ?').get(userId, req.session.userId)
            : false;

        const friends = db.prepare(`
            SELECT u.id, u.username, u.display_name, u.avatar_seed
            FROM friends f
            JOIN users u ON (f.friend_id = u.id AND f.user_id = ?) OR (f.user_id = u.id AND f.friend_id = ?)
            WHERE f.accepted = 1 AND u.id != ?
        `).all(userId, userId, userId);

        const achievements = db.prepare(`
            SELECT a.id, a.name, a.description, a.icon, ua.unlocked_at
            FROM user_achievements ua
            JOIN achievements a ON ua.achievement_id = a.id
            WHERE ua.user_id = ?
        `).all(userId);

        const isFriend = req.session.userId ? (() => {
            const r = db.prepare(`
                SELECT 1 FROM friends 
                WHERE ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)) AND accepted = 1
            `).get(req.session.userId, userId, userId, req.session.userId);
            return !!r;
        })() : false;
        const friendRequestSent = req.session.userId ? (() => {
            const r = db.prepare('SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ? AND accepted = 0').get(req.session.userId, userId);
            return !!r;
        })() : false;
        const friendRequestPending = req.session.userId ? (() => {
            const r = db.prepare('SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ? AND accepted = 0').get(userId, req.session.userId);
            return !!r;
        })() : false;

        res.json({
            user: {
                id: user.id,
                username: user.username,
                display_name: user.display_name || user.username,
                avatar_seed: user.avatar_seed || user.username,
                created_at: user.created_at
            },
            stats: stats || { games_played: 0, games_won_as_spy: 0, games_won_as_civilian: 0, games_lost: 0, rating: 0 },
            comments: comments.map(c => ({ ...c, author_name: c.author_display_name || c.author_name })),
            likeCount,
            isLiked: !!isLiked,
            friends,
            achievements,
            isFriend,
            friendRequestSent,
            friendRequestPending
        });
    } catch (err) {
        console.error('Ошибка получения профиля:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Лайк/анлайк профиля
router.post('/:id/like', (req, res) => {
    try {
        if (!req.session.userId) return res.status(401).json({ error: 'Войдите в аккаунт' });
        const profileUserId = parseInt(req.params.id);
        if (profileUserId === req.session.userId) return res.status(400).json({ error: 'Нельзя лайкнуть свой профиль' });
        
        const exists = db.prepare('SELECT 1 FROM profile_likes WHERE profile_user_id = ? AND liker_user_id = ?').get(profileUserId, req.session.userId);
        if (exists) {
            db.prepare('DELETE FROM profile_likes WHERE profile_user_id = ? AND liker_user_id = ?').run(profileUserId, req.session.userId);
        } else {
            db.prepare('INSERT INTO profile_likes (profile_user_id, liker_user_id) VALUES (?, ?)').run(profileUserId, req.session.userId);
            try {
                db.prepare('INSERT INTO notifications (user_id, type, data) VALUES (?, ?, ?)').run(profileUserId, 'profile_like', JSON.stringify({ from_user_id: req.session.userId }));
            } catch (e) { /* ignore */ }
        }
        const likeCount = db.prepare('SELECT COUNT(*) as c FROM profile_likes WHERE profile_user_id = ?').get(profileUserId).c;
        res.json({ success: true, likeCount, isLiked: !exists });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Добавить в друзья (отправить заявку)
router.post('/:id/friend', (req, res) => {
    try {
        if (!req.session.userId) return res.status(401).json({ error: 'Войдите в аккаунт' });
        const friendId = parseInt(req.params.id);
        if (friendId === req.session.userId) return res.status(400).json({ error: 'Нельзя добавить себя' });
        
        const existing = db.prepare(`
            SELECT * FROM friends 
            WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
        `).get(req.session.userId, friendId, friendId, req.session.userId);
        
        if (existing) {
            if (existing.accepted) return res.status(400).json({ error: 'Уже в друзьях' });
            if (existing.user_id === req.session.userId) return res.status(400).json({ error: 'Заявка уже отправлена' });
            // Другой пользователь отправил нам заявку — принимаем
            db.prepare('UPDATE friends SET accepted = 1 WHERE user_id = ? AND friend_id = ?').run(existing.user_id, existing.friend_id);
            checkAndGrantAchievements(req.session.userId);
            checkAndGrantAchievements(friendId);
            try {
                db.prepare('INSERT INTO notifications (user_id, type, data) VALUES (?, ?, ?)').run(friendId, 'friend_accepted', JSON.stringify({ from_user_id: req.session.userId }));
            } catch (e) { /* ignore */ }
            return res.json({ success: true, isFriend: true, friendRequestSent: false });
        }
        db.prepare('INSERT INTO friends (user_id, friend_id, accepted) VALUES (?, ?, 0)').run(req.session.userId, friendId);
        try {
            db.prepare('INSERT INTO notifications (user_id, type, data) VALUES (?, ?, ?)').run(friendId, 'friend_request', JSON.stringify({ from_user_id: req.session.userId }));
        } catch (e) { /* ignore */ }
        res.json({ success: true, isFriend: false, friendRequestSent: true });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Отклонить заявку в друзья
router.post('/:id/friend/reject', (req, res) => {
    try {
        if (!req.session.userId) return res.status(401).json({ error: 'Войдите в аккаунт' });
        const friendId = parseInt(req.params.id);
        db.prepare('DELETE FROM friends WHERE user_id = ? AND friend_id = ? AND accepted = 0').run(friendId, req.session.userId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Пригласить друга в игру
router.post('/invite-to-game', (req, res) => {
    try {
        if (!req.session.userId) return res.status(401).json({ error: 'Войдите в аккаунт' });
        const { friend_id, room_code } = req.body;
        if (!friend_id || !room_code) return res.status(400).json({ error: 'Укажите friend_id и room_code' });
        // Проверяем, что это друг
        const isFriend = db.prepare('SELECT 1 FROM friends WHERE ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)) AND accepted = 1').get(req.session.userId, friend_id, friend_id, req.session.userId);
        if (!isFriend) return res.status(400).json({ error: 'Этот пользователь не в ваших друзьях' });
        // Отправляем уведомление
        db.prepare('INSERT INTO notifications (user_id, type, data) VALUES (?, ?, ?)').run(friend_id, 'game_invite', JSON.stringify({ from_user_id: req.session.userId, room_code }));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Список друзей текущего пользователя
router.get('/friends/list', (req, res) => {
    try {
        if (!req.session.userId) return res.status(401).json({ error: 'Войдите в аккаунт' });
        const friends = db.prepare(`
            SELECT u.id, u.username, u.display_name, u.avatar_seed
            FROM friends f
            JOIN users u ON (f.friend_id = u.id AND f.user_id = ?) OR (f.user_id = u.id AND f.friend_id = ?)
            WHERE f.accepted = 1 AND u.id != ?
        `).all(req.session.userId, req.session.userId, req.session.userId);
        res.json({ friends });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Добавить комментарий на профиль
router.post('/:id/comments', (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Необходимо войти в аккаунт' });
        }

        const profileUserId = parseInt(req.params.id);
        const { text } = req.body;

        if (!text || text.trim().length === 0) {
            return res.status(400).json({ error: 'Текст комментария не может быть пустым' });
        }

        if (text.length > 500) {
            return res.status(400).json({ error: 'Комментарий не должен превышать 500 символов' });
        }

        const profileUser = db.prepare('SELECT id FROM users WHERE id = ?').get(profileUserId);
        if (!profileUser) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        const result = db.prepare(`
            INSERT INTO profile_comments (profile_user_id, author_user_id, text)
            VALUES (?, ?, ?)
        `).run(profileUserId, req.session.userId, text.trim());

        const comment = db.prepare(`
            SELECT c.id, c.text, c.created_at, u.username as author_name, u.display_name as author_display_name, u.id as author_id
            FROM profile_comments c
            JOIN users u ON c.author_user_id = u.id
            WHERE c.id = ?
        `).get(result.lastInsertRowid);
        try {
            if (profileUserId !== req.session.userId) {
                db.prepare('INSERT INTO notifications (user_id, type, data) VALUES (?, ?, ?)').run(profileUserId, 'comment', JSON.stringify({ from_user_id: req.session.userId, comment_id: result.lastInsertRowid }));
            }
        } catch (e) { /* ignore */ }

        res.json({ success: true, comment: { ...comment, author_name: comment.author_display_name || comment.author_name } });
    } catch (err) {
        console.error('Ошибка добавления комментария:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const avatarsDir = path.join(__dirname, '..', 'uploads', 'avatars');
if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });

const storageAvatars = multer.diskStorage({
    destination: (req, file, cb) => cb(null, avatarsDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'avatar-' + req.session.userId + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const uploadAvatar = multer({ storage: storageAvatars, limits: { fileSize: 2 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Только изображения'));
}});

// Загрузить аватар
router.post('/avatar/upload', uploadAvatar.single('avatar'), (req, res) => {
    try {
        if (!req.session.userId) return res.status(401).json({ error: 'Войдите в аккаунт' });
        if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
        const avatarUrl = '/uploads/avatars/' + req.file.filename;
        db.prepare('UPDATE users SET avatar_seed = ? WHERE id = ?').run(avatarUrl, req.session.userId);
        res.json({ success: true, avatar_seed: avatarUrl, avatar_url: avatarUrl });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка: ' + err.message });
    }
});

// Обновить аватар (seed)
router.put('/avatar', (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Необходимо войти в аккаунт' });
        }

        const { avatar_seed } = req.body;
        const seed = avatar_seed || req.session.username + Date.now();

        db.prepare('UPDATE users SET avatar_seed = ? WHERE id = ?').run(seed, req.session.userId);

        res.json({ success: true, avatar_seed: seed });
    } catch (err) {
        console.error('Ошибка обновления аватара:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Удалить комментарий (автор или владелец профиля)
router.delete('/:profileId/comments/:commentId', (req, res) => {
    try {
        if (!req.session.userId) return res.status(401).json({ error: 'Войдите в аккаунт' });
        const profileId = parseInt(req.params.profileId);
        const commentId = parseInt(req.params.commentId);
        const comment = db.prepare('SELECT id, profile_user_id, author_user_id FROM profile_comments WHERE id = ?').get(commentId);
        if (!comment) return res.status(404).json({ error: 'Комментарий не найден' });
        if (comment.profile_user_id !== profileId) return res.status(400).json({ error: 'Неверный профиль' });
        const canDelete = comment.author_user_id === req.session.userId || comment.profile_user_id === req.session.userId;
        if (!canDelete) return res.status(403).json({ error: 'Нет прав на удаление' });
        db.prepare('DELETE FROM profile_comments WHERE id = ?').run(commentId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Редактировать комментарий (только автор)
router.put('/:profileId/comments/:commentId', (req, res) => {
    try {
        if (!req.session.userId) return res.status(401).json({ error: 'Войдите в аккаунт' });
        const profileId = parseInt(req.params.profileId);
        const commentId = parseInt(req.params.commentId);
        const { text } = req.body;
        if (!text || text.trim().length === 0) return res.status(400).json({ error: 'Текст не может быть пустым' });
        if (text.length > 500) return res.status(400).json({ error: 'Не более 500 символов' });
        const comment = db.prepare('SELECT id, profile_user_id, author_user_id FROM profile_comments WHERE id = ?').get(commentId);
        if (!comment) return res.status(404).json({ error: 'Комментарий не найден' });
        if (comment.profile_user_id !== profileId) return res.status(400).json({ error: 'Неверный профиль' });
        if (comment.author_user_id !== req.session.userId) return res.status(403).json({ error: 'Редактировать может только автор' });
        db.prepare('UPDATE profile_comments SET text = ? WHERE id = ?').run(text.trim(), commentId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновить display_name
router.put('/display-name', (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Необходимо войти в аккаунт' });
        }

        const { display_name } = req.body;
        if (!display_name || display_name.trim().length < 2 || display_name.length > 30) {
            return res.status(400).json({ error: 'Отображаемое имя должно быть от 2 до 30 символов' });
        }

        db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(display_name.trim(), req.session.userId);

        res.json({ success: true, display_name: display_name.trim() });
    } catch (err) {
        console.error('Ошибка обновления имени:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router;
