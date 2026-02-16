const db = require('./database');

function checkAndGrantAchievements(userId) {
    const stats = db.prepare('SELECT * FROM user_stats WHERE user_id = ?').get(userId) || {};
    const friendsCount = db.prepare(`
        SELECT COUNT(*) as c FROM friends 
        WHERE (user_id = ? OR friend_id = ?) AND accepted = 1
    `).get(userId, userId).c;
    
    const checks = [
        { id: 'first_game', cond: (stats.games_played || 0) >= 1 },
        { id: 'spy_win', cond: (stats.games_won_as_spy || 0) >= 1 },
        { id: 'spy_5', cond: (stats.games_won_as_spy || 0) >= 5 },
        { id: 'civilian_win', cond: (stats.games_won_as_civilian || 0) >= 1 },
        { id: 'civilian_5', cond: (stats.games_won_as_civilian || 0) >= 5 },
        { id: 'games_10', cond: (stats.games_played || 0) >= 10 },
        { id: 'friends_5', cond: friendsCount >= 5 }
    ];
    
    const insert = db.prepare('INSERT OR IGNORE INTO user_achievements (user_id, achievement_id) VALUES (?, ?)');
    checks.forEach(({ id, cond }) => {
        if (cond) insert.run(userId, id);
    });
}

function updateRating(userId, isWin) {
    const K = 25;
    const stats = db.prepare('SELECT rating FROM user_stats WHERE user_id = ?').get(userId);
    const currentRating = stats ? (stats.rating || 1000) : 1000;
    const newRating = Math.max(0, currentRating + (isWin ? K : -Math.floor(K * 0.6)));
    db.prepare('UPDATE user_stats SET rating = ? WHERE user_id = ?').run(newRating, userId);
}

module.exports = { checkAndGrantAchievements, updateRating };
