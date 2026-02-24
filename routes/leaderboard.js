const express = require('express');
const db = require('../database');

const router = express.Router();

// Топ игроков по рейтингу
router.get('/', (req, res) => {
    try {
        const top = db.prepare(`
            SELECT u.id, u.username, u.display_name, u.avatar_seed,
                   COALESCE(s.rating, 0) as rating,
                   COALESCE(s.games_played, 0) as games_played,
                   COALESCE(s.games_won_as_spy, 0) + COALESCE(s.games_won_as_civilian, 0) as wins
            FROM users u
            LEFT JOIN user_stats s ON u.id = s.user_id
            WHERE u.deleted_at IS NULL
              AND u.is_banned = 0
            ORDER BY COALESCE(s.rating, 0) DESC
            LIMIT 50
        `).all();
        res.json({ top });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router;
