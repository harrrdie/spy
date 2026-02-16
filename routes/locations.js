const express = require('express');
const db = require('../database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const locationsDir = path.join(__dirname, '..', 'uploads', 'locations');
if (!fs.existsSync(locationsDir)) fs.mkdirSync(locationsDir, { recursive: true });

const storageLocations = multer.diskStorage({
    destination: (req, file, cb) => cb(null, locationsDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'loc-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const uploadLocation = multer({ storage: storageLocations, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Только изображения'));
}});

const DEFAULT_LOCATIONS = [
    'Пляж', 'Ресторан', 'Библиотека', 'Школа', 'Больница',
    'Кинотеатр', 'Супермаркет', 'Аэропорт', 'Стадион', 'Музей',
    'Зоопарк', 'Театр', 'Офис', 'Банк', 'Кафе',
    'Парк развлечений', 'Гостиница', 'Университет', 'Бассейн', 'Горнолыжный курорт'
];

// Список локаций для выбора (дефолтные + пользовательские всех пользователей)
router.get('/', (req, res) => {
    try {
        // Отдаем все пользовательские локации (имена могут повторяться у разных людей, это нормально)
        const custom = db.prepare('SELECT id, name FROM user_locations ORDER BY created_at DESC LIMIT 500').all();
        res.json({
            default: DEFAULT_LOCATIONS,
            custom: custom
        });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Добавить свою локацию
router.post('/', (req, res) => {
    try {
        if (!req.session.userId) return res.status(401).json({ error: 'Войдите в аккаунт' });
        const { name } = req.body;
        const n = (name || '').trim();
        if (n.length < 2) return res.status(400).json({ error: 'Название от 2 символов' });
        const result = db.prepare('INSERT INTO user_locations (user_id, name) VALUES (?, ?)').run(req.session.userId, n);
        const row = db.prepare('SELECT id, name FROM user_locations WHERE id = ?').get(result.lastInsertRowid);
        res.json({ success: true, location: row });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Список картинок (все) — до /:id
router.get('/images/all', (req, res) => {
    try {
        const rows = db.prepare(`
            SELECT li.id, li.location_id, li.image_url, li.uploaded_by
            FROM location_images li
            ORDER BY li.created_at DESC
            LIMIT 200
        `).all();
        res.json({ images: rows });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Удалить свою локацию
router.delete('/:id', (req, res) => {
    try {
        if (!req.session.userId) return res.status(401).json({ error: 'Войдите в аккаунт' });
        const id = parseInt(req.params.id);
        const row = db.prepare('SELECT id FROM user_locations WHERE id = ? AND user_id = ?').get(id, req.session.userId);
        if (!row) return res.status(404).json({ error: 'Локация не найдена' });
        db.prepare('DELETE FROM location_images WHERE location_id = ?').run(id);
        db.prepare('DELETE FROM user_locations WHERE id = ?').run(id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Картинки конкретной локации
router.get('/:id/images', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const rows = db.prepare('SELECT id, image_url FROM location_images WHERE location_id = ?').all(id);
        res.json({ images: rows });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Загрузить картинку для локации
router.post('/:id/images/upload', uploadLocation.single('image'), (req, res) => {
    try {
        if (!req.session.userId) return res.status(401).json({ error: 'Войдите в аккаунт' });
        const id = parseInt(req.params.id);
        const loc = db.prepare('SELECT id FROM user_locations WHERE id = ? AND user_id = ?').get(id, req.session.userId);
        if (!loc) return res.status(404).json({ error: 'Локация не найдена или вы не можете изменять дефолтные локации' });
        if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
        const imageUrl = '/uploads/locations/' + req.file.filename;
        db.prepare('INSERT INTO location_images (location_id, image_url, uploaded_by) VALUES (?, ?, ?)').run(id, imageUrl, req.session.userId);
        res.json({ success: true, image_url: imageUrl });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    }
});

// Добавить картинку к локации (url — ссылка на изображение)
router.post('/:id/images', (req, res) => {
    try {
        if (!req.session.userId) return res.status(401).json({ error: 'Войдите в аккаунт' });
        const id = parseInt(req.params.id);
        const { image_url } = req.body;
        const url = (image_url || '').trim();
        if (!url) return res.status(400).json({ error: 'Укажите image_url' });
        const loc = db.prepare('SELECT id FROM user_locations WHERE id = ? AND user_id = ?').get(id, req.session.userId);
        if (!loc) return res.status(404).json({ error: 'Локация не найдена' });
        db.prepare('INSERT INTO location_images (location_id, image_url, uploaded_by) VALUES (?, ?, ?)').run(id, url, req.session.userId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Добавить существующую картинку (id из /images/all) к своей локации
router.post('/:id/images/attach', (req, res) => {
    try {
        if (!req.session.userId) return res.status(401).json({ error: 'Войдите в аккаунт' });
        const id = parseInt(req.params.id);
        const { image_id } = req.body;
        const loc = db.prepare('SELECT id FROM user_locations WHERE id = ? AND user_id = ?').get(id, req.session.userId);
        if (!loc) return res.status(404).json({ error: 'Локация не найдена' });
        const img = db.prepare('SELECT id, image_url FROM location_images WHERE id = ?').get(image_id);
        if (!img) return res.status(404).json({ error: 'Изображение не найдено' });
        db.prepare('INSERT INTO location_images (location_id, image_url, uploaded_by) VALUES (?, ?, ?)').run(id, img.image_url, img.uploaded_by || null);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router;
