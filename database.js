const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'spy_game.db'));

// Инициализация таблиц
function initDatabase() {
    // Таблица пользователей
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            display_name TEXT,
            avatar_seed TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Таблица статистики игр (связь с пользователем)
    db.exec(`
        CREATE TABLE IF NOT EXISTS user_stats (
            user_id INTEGER PRIMARY KEY,
            games_played INTEGER DEFAULT 0,
            games_won_as_spy INTEGER DEFAULT 0,
            games_won_as_civilian INTEGER DEFAULT 0,
            games_lost INTEGER DEFAULT 0,
            rating INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // Таблица комментариев на профилях
    db.exec(`
        CREATE TABLE IF NOT EXISTS profile_comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            profile_user_id INTEGER NOT NULL,
            author_user_id INTEGER NOT NULL,
            text TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (profile_user_id) REFERENCES users(id),
            FOREIGN KEY (author_user_id) REFERENCES users(id)
        )
    `);

    // Лайки профилей
    db.exec(`
        CREATE TABLE IF NOT EXISTS profile_likes (
            profile_user_id INTEGER NOT NULL,
            liker_user_id INTEGER NOT NULL,
            PRIMARY KEY (profile_user_id, liker_user_id),
            FOREIGN KEY (profile_user_id) REFERENCES users(id),
            FOREIGN KEY (liker_user_id) REFERENCES users(id)
        )
    `);

    // Друзья
    db.exec(`
        CREATE TABLE IF NOT EXISTS friends (
            user_id INTEGER NOT NULL,
            friend_id INTEGER NOT NULL,
            accepted INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, friend_id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (friend_id) REFERENCES users(id)
        )
    `);

    // Достижения (справочник)
    db.exec(`
        CREATE TABLE IF NOT EXISTS achievements (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            icon TEXT
        )
    `);

    // Достижения пользователей
    db.exec(`
        CREATE TABLE IF NOT EXISTS user_achievements (
            user_id INTEGER NOT NULL,
            achievement_id TEXT NOT NULL,
            unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, achievement_id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (achievement_id) REFERENCES achievements(id)
        )
    `);

    // Миграция: добавляем rating если таблица создана без него
    try {
        const info = db.prepare("PRAGMA table_info(user_stats)").all();
        if (!info.some(c => c.name === 'rating')) {
            db.exec(`ALTER TABLE user_stats ADD COLUMN rating INTEGER DEFAULT 0`);
        }
    } catch (e) { /* игнор */ }

    // Добавляем достижения по умолчанию
    const achievements = [
        ['first_game', 'Первая игра', 'Сыграйте первую игру', 'fa-gamepad'],
        ['spy_win', 'Победный шпион', 'Выиграйте 1 игру за шпиона', 'fa-user-secret'],
        ['spy_5', 'Опытный шпион', 'Выиграйте 5 игр за шпиона', 'fa-user-ninja'],
        ['civilian_win', 'Защитник', 'Выиграйте 1 игру за мирного', 'fa-shield-alt'],
        ['civilian_5', 'Опытный детектив', 'Выиграйте 5 игр за мирного', 'fa-search'],
        ['games_10', 'Ветеран', 'Сыграйте 10 игр', 'fa-medal'],
        ['friends_5', 'Душа компании', 'Добавьте 5 друзей', 'fa-users']
    ];
    const insertAchievement = db.prepare('INSERT OR IGNORE INTO achievements (id, name, description, icon) VALUES (?, ?, ?, ?)');
    achievements.forEach(([id, name, desc, icon]) => insertAchievement.run(id, name, desc, icon));

    // Уведомления
    db.exec(`
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            data TEXT,
            read_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);`);

    // Пользовательские локации и картинки к ним
    db.exec(`
        CREATE TABLE IF NOT EXISTS user_locations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);
    db.exec(`
        CREATE TABLE IF NOT EXISTS location_images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            location_id INTEGER NOT NULL,
            image_url TEXT NOT NULL,
            uploaded_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (location_id) REFERENCES user_locations(id),
            FOREIGN KEY (uploaded_by) REFERENCES users(id)
        )
    `);

    // Индексы
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_comments_profile ON profile_comments(profile_user_id);
        CREATE INDEX IF NOT EXISTS idx_comments_author ON profile_comments(author_user_id);
        CREATE INDEX IF NOT EXISTS idx_friends_user ON friends(user_id);
        CREATE INDEX IF NOT EXISTS idx_friends_friend ON friends(friend_id);
    `);
}

initDatabase();

module.exports = db;
