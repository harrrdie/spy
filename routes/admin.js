const express = require('express');
const db = require('../database');

const router = express.Router();

function getCurrentAdmin(req) {
    if (!req.session || !req.session.userId) return null;
    const user = db.prepare(`
        SELECT id, username, is_admin, is_banned, deleted_at
        FROM users
        WHERE id = ?
    `).get(req.session.userId);
    if (!user || user.deleted_at) return null;
    if (!user.is_admin) return null;
    return user;
}

function requireAdmin(req, res, next) {
    const admin = getCurrentAdmin(req);
    if (!admin) {
        return res.status(403).json({ error: 'Требуются права администратора' });
    }
    req.admin = admin;
    next();
}

function logAdminAction(adminId, targetUserId, action, detailsObj) {
    try {
        const details = detailsObj ? JSON.stringify(detailsObj) : null;
        db.prepare(`
            INSERT INTO admin_actions (admin_id, target_user_id, action, details)
            VALUES (?, ?, ?, ?)
        `).run(adminId, targetUserId || null, action, details);
    } catch (e) {
        // не ломаем основную логику из‑за проблем логирования
        console.error('Ошибка записи admin_actions:', e);
    }
}

// Краткая сводка по системе
router.get('/summary', requireAdmin, (req, res) => {
    try {
        const totalUsers = db.prepare(`SELECT COUNT(*) AS c FROM users WHERE deleted_at IS NULL`).get().c;
        const bannedUsers = db.prepare(`SELECT COUNT(*) AS c FROM users WHERE is_banned = 1 AND deleted_at IS NULL`).get().c;
        const totalGames = db.prepare(`SELECT COUNT(*) AS c FROM game_history`).get().c;
        const totalComments = db.prepare(`SELECT COUNT(*) AS c FROM profile_comments`).get().c;
        const totalLocations = db.prepare(`SELECT COUNT(*) AS c FROM user_locations`).get().c;

        const lastUsers = db.prepare(`
            SELECT id, username, display_name, avatar_seed, created_at, is_admin, is_banned
            FROM users
            WHERE deleted_at IS NULL
            ORDER BY created_at DESC
            LIMIT 10
        `).all();

        const lastAdminActions = db.prepare(`
            SELECT a.id, a.action, a.details, a.created_at,
                   au.username AS admin_username,
                   tu.username AS target_username,
                   a.admin_id, a.target_user_id
            FROM admin_actions a
            JOIN users au ON a.admin_id = au.id
            LEFT JOIN users tu ON a.target_user_id = tu.id
            ORDER BY a.created_at DESC
            LIMIT 20
        `).all();

        res.json({
            totals: {
                users: totalUsers,
                bannedUsers,
                games: totalGames,
                comments: totalComments,
                userLocations: totalLocations
            },
            lastUsers,
            lastAdminActions
        });
    } catch (err) {
        console.error('Ошибка admin/summary:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Список пользователей с пагинацией и поиском
router.get('/users', requireAdmin, (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, parseInt(req.query.limit, 10) || 20);
        const offset = (page - 1) * limit;
        const q = (req.query.q || '').trim().toLowerCase();
        const bannedOnly = req.query.banned === '1';

        let where = 'WHERE u.deleted_at IS NULL';
        const params = [];
        if (q.length >= 2) {
            where += ' AND (LOWER(u.username) LIKE ? OR LOWER(u.display_name) LIKE ?)';
            params.push(`%${q}%`, `%${q}%`);
        }
        if (bannedOnly) {
            where += ' AND u.is_banned = 1';
        }

        const users = db.prepare(`
            SELECT 
                u.id, u.username, u.display_name, u.created_at,
                u.is_admin, u.is_banned, u.ban_reason,
                s.games_played, s.games_won_as_spy, s.games_won_as_civilian,
                s.games_lost, s.rating
            FROM users u
            LEFT JOIN user_stats s ON s.user_id = u.id
            ${where}
            ORDER BY u.created_at DESC
            LIMIT ? OFFSET ?
        `).all(...params, limit, offset);

        const total = db.prepare(`
            SELECT COUNT(*) AS c
            FROM users u
            ${where}
        `).get(...params).c;

        res.json({ users, page, limit, total });
    } catch (err) {
        console.error('Ошибка admin/users:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Один пользователь + статистика
router.get('/users/:id', requireAdmin, (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        const user = db.prepare(`
            SELECT id, username, display_name, avatar_seed, created_at,
                   is_admin, is_banned, ban_reason, deleted_at
            FROM users
            WHERE id = ?
        `).get(userId);
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

        const stats = db.prepare(`
            SELECT games_played, games_won_as_spy, games_won_as_civilian,
                   games_lost, rating
            FROM user_stats
            WHERE user_id = ?
        `).get(userId) || {
            games_played: 0,
            games_won_as_spy: 0,
            games_won_as_civilian: 0,
            games_lost: 0,
            rating: 0
        };

        const commentsCount = db.prepare(`
            SELECT COUNT(*) AS c FROM profile_comments WHERE profile_user_id = ?
        `).get(userId).c;

        const gamesCount = db.prepare(`
            SELECT COUNT(*) AS c FROM game_history WHERE user_id = ?
        `).get(userId).c;

        res.json({ user, stats, commentsCount, gamesCount });
    } catch (err) {
        console.error('Ошибка admin/users/:id:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Назначить / снять администратора
router.post('/users/:id/admin', requireAdmin, (req, res) => {
    try {
        const targetId = parseInt(req.params.id, 10);
        const { is_admin } = req.body || {};
        if (req.admin.id === targetId && !is_admin) {
            return res.status(400).json({ error: 'Нельзя снять права администратора сам с себя через панель' });
        }
        const user = db.prepare('SELECT id, username, is_admin FROM users WHERE id = ? AND deleted_at IS NULL').get(targetId);
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

        db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(is_admin ? 1 : 0, targetId);
        logAdminAction(req.admin.id, targetId, 'set_admin', { is_admin: !!is_admin });

        res.json({ success: true });
    } catch (err) {
        console.error('Ошибка admin/users/:id/admin:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Бан / разбан пользователя
router.post('/users/:id/ban', requireAdmin, (req, res) => {
    try {
        const targetId = parseInt(req.params.id, 10);
        const { ban, reason } = req.body || {};
        if (req.admin.id === targetId && ban) {
            return res.status(400).json({ error: 'Нельзя забанить самого себя' });
        }
        const user = db.prepare('SELECT id, username FROM users WHERE id = ? AND deleted_at IS NULL').get(targetId);
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

        if (ban) {
            db.prepare(`
                UPDATE users
                SET is_banned = 1,
                    ban_reason = ?,
                    deleted_at = deleted_at -- не трогаем soft-delete, если был
                WHERE id = ?
            `).run(reason || null, targetId);
        } else {
            db.prepare(`
                UPDATE users
                SET is_banned = 0,
                    ban_reason = NULL
                WHERE id = ?
            `).run(targetId);
        }

        logAdminAction(req.admin.id, targetId, ban ? 'ban_user' : 'unban_user', { reason: reason || null });

        res.json({ success: true });
    } catch (err) {
        console.error('Ошибка admin/users/:id/ban:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Мягкое удаление аккаунта
router.delete('/users/:id', requireAdmin, (req, res) => {
    try {
        const targetId = parseInt(req.params.id, 10);
        if (req.admin.id === targetId) {
            return res.status(400).json({ error: 'Нельзя удалить свой аккаунт' });
        }
        const user = db.prepare('SELECT id, username FROM users WHERE id = ? AND deleted_at IS NULL').get(targetId);
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

        db.prepare(`
            UPDATE users
            SET deleted_at = COALESCE(deleted_at, CURRENT_TIMESTAMP),
                is_banned = 1
            WHERE id = ?
        `).run(targetId);

        logAdminAction(req.admin.id, targetId, 'soft_delete_user', null);

        res.json({ success: true });
    } catch (err) {
        console.error('Ошибка admin/users/:id DELETE:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Редактирование статистики пользователя
router.put('/users/:id/stats', requireAdmin, (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        const user = db.prepare('SELECT id FROM users WHERE id = ? AND deleted_at IS NULL').get(userId);
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

        const {
            games_played,
            games_won_as_spy,
            games_won_as_civilian,
            games_lost,
            rating
        } = req.body || {};

        const stats = db.prepare('SELECT * FROM user_stats WHERE user_id = ?').get(userId);
        const payload = {
            games_played: Number.isFinite(games_played) ? Math.max(0, games_played) : stats?.games_played ?? 0,
            games_won_as_spy: Number.isFinite(games_won_as_spy) ? Math.max(0, games_won_as_spy) : stats?.games_won_as_spy ?? 0,
            games_won_as_civilian: Number.isFinite(games_won_as_civilian) ? Math.max(0, games_won_as_civilian) : stats?.games_won_as_civilian ?? 0,
            games_lost: Number.isFinite(games_lost) ? Math.max(0, games_lost) : stats?.games_lost ?? 0,
            rating: Number.isFinite(rating) ? Math.max(0, rating) : stats?.rating ?? 0
        };

        if (stats) {
            db.prepare(`
                UPDATE user_stats
                SET games_played = ?, games_won_as_spy = ?, games_won_as_civilian = ?,
                    games_lost = ?, rating = ?
                WHERE user_id = ?
            `).run(
                payload.games_played,
                payload.games_won_as_spy,
                payload.games_won_as_civilian,
                payload.games_lost,
                payload.rating,
                userId
            );
        } else {
            db.prepare(`
                INSERT INTO user_stats (user_id, games_played, games_won_as_spy, games_won_as_civilian, games_lost, rating)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(
                userId,
                payload.games_played,
                payload.games_won_as_spy,
                payload.games_won_as_civilian,
                payload.games_lost,
                payload.rating
            );
        }

        logAdminAction(req.admin.id, userId, 'edit_stats', payload);

        res.json({ success: true, stats: payload });
    } catch (err) {
        console.error('Ошибка admin/users/:id/stats:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Комментарии для модерации
router.get('/comments', requireAdmin, (req, res) => {
    try {
        const profileUserId = req.query.profile_user_id ? parseInt(req.query.profile_user_id, 10) : null;
        const authorUserId = req.query.author_user_id ? parseInt(req.query.author_user_id, 10) : null;
        const q = (req.query.q || '').trim().toLowerCase();
        const limit = Math.min(100, parseInt(req.query.limit, 10) || 50);

        let where = 'WHERE 1=1';
        const params = [];
        if (profileUserId) {
            where += ' AND c.profile_user_id = ?';
            params.push(profileUserId);
        }
        if (authorUserId) {
            where += ' AND c.author_user_id = ?';
            params.push(authorUserId);
        }
        if (q.length >= 2) {
            where += ' AND LOWER(c.text) LIKE ?';
            params.push(`%${q}%`);
        }

        const comments = db.prepare(`
            SELECT 
                c.id, c.text, c.created_at,
                c.profile_user_id, c.author_user_id,
                pu.username AS profile_username,
                au.username AS author_username
            FROM profile_comments c
            JOIN users pu ON pu.id = c.profile_user_id
            JOIN users au ON au.id = c.author_user_id
            ${where}
            ORDER BY c.created_at DESC
            LIMIT ?
        `).all(...params, limit);

        res.json({ comments });
    } catch (err) {
        console.error('Ошибка admin/comments:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Удалить комментарий через админ-панель
router.delete('/comments/:id', requireAdmin, (req, res) => {
    try {
        const commentId = parseInt(req.params.id, 10);
        const comment = db.prepare(`
            SELECT id, profile_user_id, author_user_id
            FROM profile_comments
            WHERE id = ?
        `).get(commentId);
        if (!comment) return res.status(404).json({ error: 'Комментарий не найден' });

        db.prepare('DELETE FROM profile_comments WHERE id = ?').run(commentId);
        logAdminAction(req.admin.id, comment.author_user_id, 'delete_comment', {
            comment_id: commentId,
            profile_user_id: comment.profile_user_id
        });

        res.json({ success: true });
    } catch (err) {
        console.error('Ошибка admin/comments/:id DELETE:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Локации пользователей (для массовых операций)
router.get('/user-locations', requireAdmin, (req, res) => {
    try {
        const userId = req.query.user_id ? parseInt(req.query.user_id, 10) : null;
        let where = 'WHERE 1=1';
        const params = [];
        if (userId) {
            where += ' AND ul.user_id = ?';
            params.push(userId);
        }

        const locations = db.prepare(`
            SELECT 
                ul.id, ul.user_id, ul.name, ul.created_at,
                u.username,
                (SELECT COUNT(*) FROM location_images li WHERE li.location_id = ul.id) AS images_count
            FROM user_locations ul
            JOIN users u ON u.id = ul.user_id
            ${where}
            ORDER BY ul.created_at DESC
            LIMIT 500
        `).all(...params);

        res.json({ locations });
    } catch (err) {
        console.error('Ошибка admin/user-locations:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Массовое создание пользовательских локаций
router.post('/user-locations/bulk-create', requireAdmin, (req, res) => {
    try {
        const { names, user_id } = req.body || {};
        if (!Array.isArray(names) || names.length === 0) {
            return res.status(400).json({ error: 'Передайте массив names' });
        }
        const targetUserId = user_id ? parseInt(user_id, 10) : req.admin.id;
        const targetUser = db.prepare('SELECT id FROM users WHERE id = ? AND deleted_at IS NULL').get(targetUserId);
        if (!targetUser) return res.status(400).json({ error: 'Целевой пользователь не найден' });

        const insert = db.prepare(`
            INSERT INTO user_locations (user_id, name)
            VALUES (?, ?)
        `);

        const created = [];
        const tx = db.transaction((items) => {
            items.forEach((rawName) => {
                const name = (rawName || '').trim();
                if (!name || name.length < 2) return;
                const result = insert.run(targetUserId, name);
                created.push({ id: result.lastInsertRowid, name });
            });
        });
        tx(names);

        if (created.length) {
            logAdminAction(req.admin.id, targetUserId, 'bulk_create_locations', {
                count: created.length
            });
        }

        res.json({ success: true, created });
    } catch (err) {
        console.error('Ошибка admin/user-locations/bulk-create:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Массовое обновление названий локаций
router.post('/user-locations/bulk-update', requireAdmin, (req, res) => {
    try {
        const { items } = req.body || {};
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Передайте массив items' });
        }

        const update = db.prepare(`
            UPDATE user_locations
            SET name = ?
            WHERE id = ?
        `);

        const tx = db.transaction((rows) => {
            rows.forEach((row) => {
                const id = parseInt(row.id, 10);
                const name = (row.name || '').trim();
                if (!id || !name) return;
                update.run(name, id);
            });
        });
        tx(items);

        logAdminAction(req.admin.id, null, 'bulk_update_locations', { count: items.length });

        res.json({ success: true });
    } catch (err) {
        console.error('Ошибка admin/user-locations/bulk-update:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Массовое удаление локаций
router.post('/user-locations/bulk-delete', requireAdmin, (req, res) => {
    try {
        const { ids } = req.body || {};
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'Передайте массив ids' });
        }
        const deleteImages = db.prepare('DELETE FROM location_images WHERE location_id = ?');
        const deleteLocations = db.prepare('DELETE FROM user_locations WHERE id = ?');

        const tx = db.transaction((locationIds) => {
            locationIds.forEach((rawId) => {
                const id = parseInt(rawId, 10);
                if (!id) return;
                deleteImages.run(id);
                deleteLocations.run(id);
            });
        });
        tx(ids);

        logAdminAction(req.admin.id, null, 'bulk_delete_locations', { count: ids.length });

        res.json({ success: true });
    } catch (err) {
        console.error('Ошибка admin/user-locations/bulk-delete:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Картинки локаций и массовое удаление
router.get('/location-images', requireAdmin, (req, res) => {
    try {
        const locationId = req.query.location_id ? parseInt(req.query.location_id, 10) : null;
        let where = 'WHERE 1=1';
        const params = [];
        if (locationId) {
            where += ' AND li.location_id = ?';
            params.push(locationId);
        }

        const images = db.prepare(`
            SELECT li.id, li.location_id, li.image_url, li.uploaded_by, li.created_at
            FROM location_images li
            ${where}
            ORDER BY li.created_at DESC
            LIMIT 500
        `).all(...params);

        res.json({ images });
    } catch (err) {
        console.error('Ошибка admin/location-images:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

router.post('/location-images/bulk-delete', requireAdmin, (req, res) => {
    try {
        const { ids } = req.body || {};
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'Передайте массив ids' });
        }
        const del = db.prepare('DELETE FROM location_images WHERE id = ?');
        const tx = db.transaction((imageIds) => {
            imageIds.forEach((rawId) => {
                const id = parseInt(rawId, 10);
                if (!id) return;
                del.run(id);
            });
        });
        tx(ids);

        logAdminAction(req.admin.id, null, 'bulk_delete_location_images', { count: ids.length });

        res.json({ success: true });
    } catch (err) {
        console.error('Ошибка admin/location-images/bulk-delete:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router;

