const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const db = require('./database');
const { checkAndGrantAchievements } = require('./achievements');
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const leaderboardRoutes = require('./routes/leaderboard');
const locationsRoutes = require('./routes/locations');

// Конфигурация сервера
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Доверяем прокси (Render и другие PaaS используют прокси перед Node-сервером)
app.set('trust proxy', 1);

app.use(session({
    secret: process.env.SESSION_SECRET || 'spy-game-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        // В проде (на Render) куки будут только по HTTPS
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000
    }
}));

// Данные игровых комнат
const rooms = {};
const players = {};
const defaultLocations = [
    "Пляж", "Ресторан", "Библиотека", "Школа", "Больница", 
    "Кинотеатр", "Супермаркет", "Аэропорт", "Стадион", "Музей",
    "Зоопарк", "Театр", "Офис", "Банк", "Кафе", 
    "Парк развлечений", "Гостиница", "Университет", "Бассейн", "Горнолыжный курорт"
];

// API маршруты
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/locations', locationsRoutes);

// Создаем папки для загрузок
const uploadsDir = path.join(__dirname, 'uploads');
const locationsDir = path.join(uploadsDir, 'locations');
const avatarsDir = path.join(uploadsDir, 'avatars');
[uploadsDir, locationsDir, avatarsDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (req.path.includes('/locations')) cb(null, locationsDir);
        else if (req.path.includes('/avatars')) cb(null, avatarsDir);
        else cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Middleware для статики
app.use(express.static(__dirname));
app.use('/uploads', express.static(uploadsDir));

// Маршруты страниц
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'auth.html'));
});
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'auth.html'));
});
app.get('/profile/:id?', (req, res) => {
    res.sendFile(path.join(__dirname, 'profile.html'));
});
app.get('/leaderboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'leaderboard.html'));
});
app.get('/room/:code', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// QR-код приглашения в комнату
app.get('/api/room/:code/qr', async (req, res) => {
    try {
        const roomCode = (req.params.code || '').toUpperCase();
        if (!roomCode) {
            return res.status(400).send('Room code is required');
        }

        // Строим публичный URL комнаты
        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        const inviteUrl = `${protocol}://${host}/room/${roomCode}`;

        const pngBuffer = await QRCode.toBuffer(inviteUrl, {
            type: 'png',
            width: 300,
            margin: 1,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.send(pngBuffer);
    } catch (err) {
        console.error('Ошибка генерации QR-кода:', err);
        res.status(500).send('Failed to generate QR code');
    }
});

// Генерация случайного кода комнаты
function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Получение случайного элемента из массива
function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// Socket.io обработчики
io.on('connection', (socket) => {
    console.log('Новое подключение:', socket.id);
    
    // Присоединение к комнате
    socket.on('join_room', (data) => {
        const { playerName, roomCode, userId } = data;
        
        if (!rooms[roomCode]) {
            socket.emit('error', { message: 'Комната не найдена' });
            return;
        }
        
        if (rooms[roomCode].gameStarted) {
            socket.emit('error', { message: 'Игра уже началась' });
            return;
        }
        
        let finalName = playerName;
        let finalUserId = userId || null;
        let avatarSeed = null;
        
        if (userId) {
            const user = db.prepare('SELECT display_name, username, avatar_seed FROM users WHERE id = ?').get(userId);
            if (!user) {
                socket.emit('error', { message: 'Пользователь не найден' });
                return;
            }
            const displayName = (user.display_name || user.username).trim();
            if (playerName.trim().toLowerCase() !== displayName.toLowerCase()) {
                socket.emit('error', { message: 'Авторизованные игроки могут использовать только имя из профиля: ' + displayName });
                return;
            }
            finalName = displayName;
            avatarSeed = user.avatar_seed || user.username;
        } else {
            // Для неавторизованных пользователей проверяем, не занят ли никнейм
            const trimmedName = playerName.trim();
            const existingUser = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(display_name) = LOWER(?)').get(trimmedName, trimmedName);
            if (existingUser) {
                socket.emit('error', { message: 'Этот никнейм уже занят зарегистрированным пользователем. Пожалуйста, используйте другой или войдите в аккаунт.' });
                return;
            }
        }
        
        const duplicateName = rooms[roomCode].players.some(p => 
            p.name.toLowerCase() === finalName.toLowerCase()
        );
        
        if (duplicateName) {
            socket.emit('error', { message: 'Игрок с таким именем уже есть в комнате' });
            return;
        }
        
        const player = {
            id: socket.id,
            name: finalName,
            roomCode: roomCode,
            isHost: false,
            role: null,
            isSpy: false,
            hasBeenAsked: false,
            hasAsked: false,
            userId: finalUserId,
            avatarSeed: avatarSeed
        };
        
        players[socket.id] = player;
        rooms[roomCode].players.push(player);
        
        // Присоединяем сокет к комнате
        socket.join(roomCode);
        
        // Находим хоста
        const host = rooms[roomCode].players.find(p => p.isHost);
        
        // Отправляем информацию о присоединении
        socket.emit('room_joined', {
            playerId: socket.id,
            roomCode: roomCode,
            isHost: false,
            hostName: host ? host.name : '-',
            players: rooms[roomCode].players
        });
        
        // Уведомляем других игроков
        io.to(roomCode).emit('players_update', {
            players: rooms[roomCode].players,
            hostName: host ? host.name : '-'
        });
        
        io.to(roomCode).emit('system_message', {
            message: `${finalName} присоединился к игре`
        });
    });
    
    // Создание комнаты
    socket.on('create_room', (data) => {
        const { playerName, userId } = data;
        
        let finalName = playerName;
        let finalUserId = userId || null;
        let avatarSeed = null;
        if (userId) {
            const user = db.prepare('SELECT display_name, username, avatar_seed FROM users WHERE id = ?').get(userId);
            if (!user) {
                socket.emit('error', { message: 'Пользователь не найден' });
                return;
            }
            const displayName = (user.display_name || user.username).trim();
            if (playerName.trim().toLowerCase() !== displayName.toLowerCase()) {
                socket.emit('error', { message: 'Авторизованные игроки могут использовать только имя из профиля: ' + displayName });
                return;
            }
            finalName = displayName;
            avatarSeed = user.avatar_seed || user.username;
        } else {
            // Для неавторизованных пользователей проверяем, не занят ли никнейм
            const trimmedName = playerName.trim();
            const existingUser = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(display_name) = LOWER(?)').get(trimmedName, trimmedName);
            if (existingUser) {
                socket.emit('error', { message: 'Этот никнейм уже занят зарегистрированным пользователем. Пожалуйста, используйте другой или войдите в аккаунт.' });
                return;
            }
        }
        
        // Генерируем код комнаты
        let roomCode;
        do {
            roomCode = generateRoomCode();
        } while (rooms[roomCode]);
        
        // Создаем комнату
        rooms[roomCode] = {
            code: roomCode,
            players: [],
            gameStarted: false,
            locations: [...defaultLocations],
            currentLocation: null,
            spyId: null,
            turnTime: 60, // 1 минута на ход
            timerInterval: null,
            votes: {},
            roundActive: false,
            currentTurnPlayerId: null,
            currentQuestion: null,
            askedPlayers: new Set(),
            earlyVoteRequests: 0,
            questionChain: [],
            spyGuessedLocation: false,
            spyGuessing: false,
            spyGuessOptions: [],
            gameEnded: false
        };
        
        const player = {
            id: socket.id,
            name: finalName,
            roomCode: roomCode,
            isHost: true,
            role: null,
            isSpy: false,
            hasBeenAsked: false,
            hasAsked: false,
            userId: finalUserId,
            avatarSeed: avatarSeed
        };
        
        players[socket.id] = player;
        rooms[roomCode].players.push(player);
        
        // Присоединяем сокет к комнате
        socket.join(roomCode);
        
        // Отправляем информацию о создании комнаты
        socket.emit('room_joined', {
            playerId: socket.id,
            roomCode: roomCode,
            isHost: true,
            hostName: playerName,
            players: rooms[roomCode].players
        });
    });
    
    // Покинуть комнату
    socket.on('leave_room', () => {
        const player = players[socket.id];
        if (!player) return;
        
        const roomCode = player.roomCode;
        const room = rooms[roomCode];
        
        if (room) {
            // Удаляем игрока из комнаты
            room.players = room.players.filter(p => p.id !== socket.id);
            
            // Если игрок был хостом и в комнате остались игроки, назначаем нового хоста
            if (player.isHost && room.players.length > 0) {
                room.players[0].isHost = true;
                
                // Уведомляем о новом хосте
                io.to(roomCode).emit('system_message', {
                    message: `${room.players[0].name} теперь хост комнаты`
                });
            }
            
            // Если игра началась, завершаем ее
            if (room.gameStarted) {
                room.gameStarted = false;
                clearInterval(room.timerInterval);
                
                io.to(roomCode).emit('system_message', {
                    message: 'Игра прервана, так как один из игроков покинул комнату'
                });
                
                // Возвращаем всех в лобби
                returnToLobby(room);
            }
            
            // Находим нового хоста
            const newHost = room.players.find(p => p.isHost);
            
            // Уведомляем других игроков
            io.to(roomCode).emit('players_update', {
                players: room.players,
                hostName: newHost ? newHost.name : '-'
            });
            
            io.to(roomCode).emit('system_message', {
                message: `${player.name} покинул игру`
            });
            
            // Если комната пуста, удаляем ее
            if (room.players.length === 0) {
                clearInterval(room.timerInterval);
                delete rooms[roomCode];
            }
        }
        
        // Удаляем игрока
        delete players[socket.id];
        
        // Покидаем комнату сокета
        socket.leave(roomCode);
    });
    
    // Начать игру
    socket.on('start_game', (data) => {
        const { roomCode, locations } = data;
        const room = rooms[roomCode];
        
        if (!room) return;
        
        // Проверяем, что игрок является хостом
        const player = players[socket.id];
        if (!player || !player.isHost) {
            socket.emit('error', { message: 'Только хост может начать игру' });
            return;
        }
        
        // Проверяем, что игроков достаточно
        if (room.players.length < 3) {
            socket.emit('error', { message: 'Необходимо минимум 3 игрока для начала игры' });
            return;
        }
        
        if (locations && locations.length < 5) {
            socket.emit('error', { message: 'Необходимо минимум 5 локаций для игры' });
            return;
        }
        
        // Обновляем настройки игры
        room.gameStarted = true;
        room.gameEnded = false;
        
        if (locations && locations.length > 0) {
            room.locations = locations;
        }
        
        // Начинаем игру
        startGame(room);
    });
    
    // Отправка сообщения в общий чат
    socket.on('send_social_message', (data) => {
        const { roomCode, message } = data;
        const player = players[socket.id];
        
        if (!player || player.roomCode !== roomCode) return;
        
        // Отправляем сообщение всем игрокам в комнате
        io.to(roomCode).emit('new_social_message', {
            sender: player.name,
            senderId: player.id,
            message: message,
            isGuest: !player.userId,
            avatarSeed: player.avatarSeed
        });
    });
    
    // Угадать локацию (для шпиона)
    socket.on('guess_location', (data) => {
        const { roomCode, guess } = data;
        const room = rooms[roomCode];
        const player = players[socket.id];
        
        if (!room || !player || !room.gameStarted || room.gameEnded) return;
        
        // Проверяем, что игрок является шпионом
        if (room.spyId !== socket.id) {
            socket.emit('error', { message: 'Только шпион может угадывать локацию' });
            return;
        }
        
        // Если шпион пытается угадать после того, как его вычислили
        if (room.spyGuessing) {
            const isCorrect = guess.toLowerCase() === room.currentLocation.toLowerCase();
            
            io.to(roomCode).emit('system_message', {
                message: `Шпион ${player.name} пытается угадать локацию! Он сказал: "${guess}"`
            });
            
            if (isCorrect) {
                // Шпион угадал локацию
                io.to(roomCode).emit('system_message', {
                    message: `Шпион ${player.name} угадал локацию "${room.currentLocation}"! Шпион побеждает!`
                });
                
                // Завершаем игру в пользу шпиона
                endGame(room, true);
            } else {
                io.to(roomCode).emit('system_message', {
                    message: `Шпион ${player.name} не угадал локацию. Правильная локация: "${room.currentLocation}". Шпион проиграл!`
                });
                
                // Завершаем игру в пользу мирных жителей
                endGame(room, false);
            }
            room.spyGuessing = false;
        } else {
            // Обычная попытка угадать локацию во время игры
            const isCorrect = guess.toLowerCase() === room.currentLocation.toLowerCase();
            
            io.to(roomCode).emit('system_message', {
                message: `Шпион пытается угадать локацию! Он сказал: "${guess}"`
            });
            
            if (isCorrect) {
                // Шпион угадал локацию
                io.to(roomCode).emit('system_message', {
                    message: 'Шпион угадал локацию! Игра завершена.'
                });
                
                // Завершаем игру
                endGame(room, true);
            } else {
                io.to(roomCode).emit('system_message', {
                    message: 'Шпион не угадал локацию. Игра продолжается.'
                });
            }
        }
    });
    
    // Получить варианты для угадывания локации (для шпиона)
    socket.on('get_spy_guess_options', (data) => {
        const { roomCode } = data;
        const room = rooms[roomCode];
        const player = players[socket.id];
        
        if (!room || !player || !room.gameStarted || room.gameEnded) return;
        
        // Проверяем, что игрок является шпионом
        if (room.spyId !== socket.id) {
            socket.emit('error', { message: 'Только шпион может угадывать локацию' });
            return;
        }
        
        // Выбираем 5 случайных локаций, включая правильную
        let options = [...room.locations];
        options = options.filter(loc => loc !== room.currentLocation);
        
        // Перемешиваем
        options = options.sort(() => Math.random() - 0.5).slice(0, 4);
        
        // Добавляем правильную локацию
        options.push(room.currentLocation);
        
        // Еще раз перемешиваем
        room.spyGuessOptions = options.sort(() => Math.random() - 0.5);
        
        // Отправляем варианты шпиону
        socket.emit('spy_guess_options', {
            options: room.spyGuessOptions
        });
    });
    
    // Инициировать досрочное голосование
    socket.on('initiate_early_vote', (data) => {
        const { roomCode } = data;
        const room = rooms[roomCode];
        const player = players[socket.id];
        
        if (!room || !player || !room.gameStarted || room.gameEnded) return;
        
        // Увеличиваем счетчик запросов на досрочное голосование
        room.earlyVoteRequests++;
        
        // Проверяем, достаточно ли запросов для начала голосования
        const requiredVotes = Math.ceil(room.players.length / 2);
        
        io.to(roomCode).emit('system_message', {
            message: `${player.name} предлагает начать досрочное голосование (${room.earlyVoteRequests}/${requiredVotes})`
        });
        
        if (room.earlyVoteRequests >= requiredVotes) {
            // Начинаем голосование
            startVoting(room);
        }
    });
    
    // Получить список доступных игроков для вопроса
    socket.on('get_available_players', (data) => {
        const { roomCode } = data;
        const room = rooms[roomCode];
        const player = players[socket.id];
        
        if (!room || !player || !room.gameStarted || room.gameEnded) return;
        
        // Проверяем, что сейчас ход этого игрока
        if (room.currentTurnPlayerId !== socket.id) {
            socket.emit('error', { message: 'Сейчас не ваш ход' });
            return;
        }
        
        // Находим всех игроков, кроме себя и шпиона (если это не шпион)
        const availablePlayers = room.players.filter(p => 
            p.id !== socket.id
        );
        
        socket.emit('available_players', {
            players: availablePlayers.map(p => ({
                id: p.id,
                name: p.name,
                hasBeenAsked: p.hasBeenAsked
            }))
        });
    });
    
    // Задать вопрос
    socket.on('ask_question', (data) => {
        const { roomCode, targetPlayerId, question } = data;
        const room = rooms[roomCode];
        const player = players[socket.id];
        const targetPlayer = players[targetPlayerId];
        
        if (!room || !player || !targetPlayer || !room.gameStarted || room.gameEnded) return;
        
        // Проверяем, что сейчас ход этого игрока
        if (room.currentTurnPlayerId !== socket.id) {
            socket.emit('error', { message: 'Сейчас не ваш ход' });
            return;
        }
        
        // Проверяем, что не задаем вопрос самому себе
        if (targetPlayerId === socket.id) {
            socket.emit('error', { message: 'Нельзя задавать вопрос самому себе' });
            return;
        }
        
        // Помечаем игрока как задавшего вопрос
        player.hasAsked = true;
        // Помечаем игрока как получившего вопрос
        targetPlayer.hasBeenAsked = true;
        
        // Сохраняем текущий вопрос
        room.currentQuestion = {
            askerId: socket.id,
            askerName: player.name,
            targetId: targetPlayerId,
            targetName: targetPlayer.name,
            question: question
        };
        
        // Отправляем вопрос и ответ в чат для всех
        io.to(roomCode).emit('question_asked_chat', {
            askerName: player.name,
            targetName: targetPlayer.name,
            question: question,
            askerId: socket.id,
            askerAvatarSeed: player.avatarSeed
        });
        
        // Отправляем вопрос целевому игроку
        io.to(targetPlayerId).emit('receive_question', {
            askerName: player.name,
            question: question
        });
        
        // Сбрасываем таймер
        clearInterval(room.timerInterval);
        startTurnTimer(room, room.turnTime, 'answer');
    });
    
    // Ответить на вопрос
    socket.on('answer_question', (data) => {
        const { roomCode, answer } = data;
        const room = rooms[roomCode];
        const player = players[socket.id];
        
        if (!room || !player || !room.gameStarted || room.gameEnded) return;
        
        // Проверяем, что этот игрок должен отвечать на вопрос
        if (!room.currentQuestion || room.currentQuestion.targetId !== socket.id) {
            socket.emit('error', { message: 'Сейчас не ваш ход для ответа' });
            return;
        }
        
        // Отправляем ответ в чат для всех
        io.to(roomCode).emit('answer_received_chat', {
            answererName: player.name,
            answer: answer,
            question: room.currentQuestion.question,
            askerName: room.currentQuestion.askerName,
            answererAvatarSeed: player.avatarSeed
        });
        
        // Добавляем игрока в цепочку вопросов
        room.questionChain.push({
            asker: room.currentQuestion.askerName,
            answerer: player.name,
            question: room.currentQuestion.question,
            answer: answer
        });
        
        // Выбираем следующего игрока для вопроса (этот, кто только что ответил)
        room.currentTurnPlayerId = socket.id;
        
        // Отправляем информацию о следующем ходе
        io.to(room.code).emit('next_turn', {
            nextPlayerId: player.id,
            nextPlayerName: player.name
        });
        
        // Запускаем таймер для вопроса
        startTurnTimer(room, room.turnTime, 'question');
    });
    
    // Получить список игроков для голосования
    socket.on('get_vote_options', (data) => {
        const { roomCode } = data;
        const room = rooms[roomCode];
        
        if (!room) return;
        
        // Отправляем список всех игроков, кроме себя
        const voteOptions = room.players.filter(p => p.id !== socket.id).map(p => ({
            id: p.id,
            name: p.name
        }));
        
        socket.emit('vote_options', {
            players: voteOptions
        });
    });
    
    // Проголосовать
    socket.on('submit_vote', (data) => {
        const { roomCode, votedPlayerId } = data;
        const room = rooms[roomCode];
        const player = players[socket.id];
        
        if (!room || !player || !room.gameStarted || room.gameEnded) return;
        
        // Регистрируем голос
        room.votes[socket.id] = votedPlayerId;
        
        const votedPlayer = players[votedPlayerId];
        const votedPlayerName = votedPlayer ? votedPlayer.name : 'Неизвестно';
        
        // Отправляем уведомление
        io.to(roomCode).emit('system_message', {
            message: `${player.name} проголосовал за ${votedPlayerName}`
        });
        
        // Проверяем, все ли проголосовали
        const allVoted = room.players.every(p => room.votes[p.id] !== undefined);
        
        if (allVoted) {
            // Подсчитываем голоса
            const voteCount = {};
            Object.values(room.votes).forEach(votedId => {
                voteCount[votedId] = (voteCount[votedId] || 0) + 1;
            });
            
            // Находим игрока с наибольшим количеством голосов
            let maxVotes = 0;
            let mostVotedPlayerId = null;
            let voteTies = [];
            
            Object.entries(voteCount).forEach(([playerId, votes]) => {
                if (votes > maxVotes) {
                    maxVotes = votes;
                    mostVotedPlayerId = playerId;
                    voteTies = [playerId];
                } else if (votes === maxVotes) {
                    voteTies.push(playerId);
                }
            });
            
            // Если голоса разделились поровну, продолжаем игру
            if (voteTies.length > 1) {
                io.to(roomCode).emit('system_message', {
                    message: 'Голоса разделились поровну! Игра продолжается.'
                });
                
                // Сбрасываем голоса и продолжаем игру
                room.votes = {};
                room.earlyVoteRequests = 0;
                
                // Возвращаемся к вопросам
                const nextPlayer = getNextQuestionPlayer(room);
                if (nextPlayer) {
                    room.currentTurnPlayerId = nextPlayer.id;
                    io.to(room.code).emit('next_turn', {
                        nextPlayerId: nextPlayer.id,
                        nextPlayerName: nextPlayer.name
                    });
                    startTurnTimer(room, room.turnTime, 'question');
                }
                return;
            }
            
            // Проверяем, является ли этот игрок шпионом
            const isSpyCaught = mostVotedPlayerId === room.spyId;
            
            if (isSpyCaught) {
                // Шпион пойман, даем ему шанс угадать локацию
                room.spyGuessing = true;
                const spyPlayer = players[room.spyId];
                
                io.to(roomCode).emit('system_message', {
                    message: `Шпион ${spyPlayer.name} пойман! У него есть шанс угадать локацию и выиграть.`
                });
                
                // Отправляем шпиону варианты для угадывания
                io.to(room.spyId).emit('spy_caught_guess', {
                    message: 'Вас поймали! Угадайте локацию из 5 вариантов, чтобы выиграть.'
                });
                
                // Запускаем таймер для угадывания
                startTurnTimer(room, 60, 'spy_guess');
            } else {
                // Не шпиона поймали
                const caughtPlayer = players[mostVotedPlayerId];
                io.to(roomCode).emit('system_message', {
                    message: `Игрок ${caughtPlayer.name} был ошибочно обвинен! Он не шпион. Шпион побеждает!`
                });
                
                // Завершаем игру в пользу шпиона
                endGame(room, true);
            }
        }
    });
    
    // Время вышло
    socket.on('time_up', (data) => {
        const { roomCode, timerType } = data;
        const room = rooms[roomCode];
        const player = players[socket.id];
        
        if (!room || !room.gameStarted || room.gameEnded || !player) return;
        
        if (timerType === 'answer' && room.currentQuestion && room.currentQuestion.targetId === socket.id) {
            // Игрок не успел ответить
            io.to(roomCode).emit('system_message', {
                message: `Время вышло! ${player.name} не успел ответить на вопрос.`
            });
            
            // Передаем ход следующему игроку
            const nextPlayer = getNextQuestionPlayer(room);
            if (nextPlayer) {
                room.currentTurnPlayerId = nextPlayer.id;
                io.to(room.code).emit('next_turn', {
                    nextPlayerId: nextPlayer.id,
                    nextPlayerName: nextPlayer.name
                });
                startTurnTimer(room, room.turnTime, 'question');
            }
        } else if (timerType === 'question' && room.currentTurnPlayerId === socket.id) {
            // Игрок не успел задать вопрос
            io.to(roomCode).emit('system_message', {
                message: `Время вышло! ${player.name} не успел задать вопрос.`
            });
            
            // Передаем ход следующему игроку
            const nextPlayer = getNextQuestionPlayer(room);
            if (nextPlayer) {
                room.currentTurnPlayerId = nextPlayer.id;
                io.to(room.code).emit('next_turn', {
                    nextPlayerId: nextPlayer.id,
                    nextPlayerName: nextPlayer.name
                });
                startTurnTimer(room, room.turnTime, 'question');
            }
        } else if (timerType === 'spy_guess' && room.spyGuessing && room.spyId === socket.id) {
            // Шпион не успел угадать локацию
            io.to(roomCode).emit('system_message', {
                message: `Время вышло! Шпион ${player.name} не успел угадать локацию.`
            });
            
            // Завершаем игру в пользу мирных жителей
            endGame(room, false);
        }
    });
    
    // Исключить игрока
    socket.on('kick_player', (data) => {
        const { roomCode, playerId } = data;
        const room = rooms[roomCode];
        const host = players[socket.id];
        
        if (!room || !host || !host.isHost) return;
        
        // Находим игрока для исключения
        const playerToKick = room.players.find(p => p.id === playerId);
        if (!playerToKick) return;
        
        // Не позволяем исключить себя
        if (playerToKick.id === host.id) return;
        
        // Удаляем игрока из комнаты
        room.players = room.players.filter(p => p.id !== playerId);
        
        // Удаляем игрока из глобального списка
        if (players[playerId]) {
            delete players[playerId];
        }
        
        // Получаем сокет исключаемого игрока
        const playerSocket = io.sockets.sockets.get(playerId);
        if (playerSocket) {
            // Отправляем уведомление исключаемому игроку
            playerSocket.emit('player_kicked', {
                kickedPlayerId: playerId,
                kickedPlayerName: playerToKick.name
            });
            
            // Отключаем сокет от комнаты
            playerSocket.leave(roomCode);
        }
        
        // Уведомляем остальных игроков
        const newHost = room.players.find(p => p.isHost);
        io.to(roomCode).emit('players_update', {
            players: room.players,
            hostName: newHost ? newHost.name : '-'
        });
        
        io.to(roomCode).emit('player_kicked', {
            kickedPlayerId: playerId,
            kickedPlayerName: playerToKick.name
        });
        
        // Если игра началась и игрок был исключен, завершаем игру
        if (room.gameStarted) {
            room.gameStarted = false;
            clearInterval(room.timerInterval);
            
            io.to(roomCode).emit('system_message', {
                message: 'Игра прервана, так как один из игроков был исключен'
            });
            
            // Возвращаем всех в лобби
            returnToLobby(room);
        }
    });
    
    // Отключение игрока
    socket.on('disconnect', () => {
        console.log('Отключение:', socket.id);
        
        const player = players[socket.id];
        if (!player) return;
        
        const roomCode = player.roomCode;
        const room = rooms[roomCode];
        
        if (room) {
            // Удаляем игрока из комнаты
            room.players = room.players.filter(p => p.id !== socket.id);
            
            // Если игрок был хостом и в комнате остались игроки, назначаем нового хоста
            if (player.isHost && room.players.length > 0) {
                room.players[0].isHost = true;
            }
            
            // Если игра началась, завершаем ее
            if (room.gameStarted) {
                room.gameStarted = false;
                clearInterval(room.timerInterval);
                
                io.to(roomCode).emit('system_message', {
                    message: 'Игра прервана, так как один из игроков отключился'
                });
                
                // Возвращаем всех в лобби
                returnToLobby(room);
            }
            
            // Находим нового хоста
            const newHost = room.players.find(p => p.isHost);
            
            // Уведомляем других игроков
            io.to(roomCode).emit('players_update', {
                players: room.players,
                hostName: newHost ? newHost.name : '-'
            });
            
            io.to(roomCode).emit('system_message', {
                message: `${player.name} отключился`
            });
            
            // Если комната пуста, удаляем ее
            if (room.players.length === 0) {
                clearInterval(room.timerInterval);
                delete rooms[roomCode];
            }
        }
        
        // Удаляем игрока
        delete players[socket.id];
    });
});

// Функция получения следующего игрока для вопроса
function getNextQuestionPlayer(room) {
    // Ищем любого игрока, кроме текущего
    const otherPlayers = room.players.filter(p => p.id !== room.currentTurnPlayerId);
    if (otherPlayers.length > 0) {
        // Выбираем случайного игрока
        return otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
    }
    
    return null;
}

// Функция начала игры
function startGame(room) {
    room.roundActive = true;
    room.votes = {};
    room.earlyVoteRequests = 0;
    room.questionChain = [];
    room.spyGuessedLocation = false;
    room.spyGuessing = false;
    room.spyGuessOptions = [];
    room.gameEnded = false;
    
    // Сбрасываем флаги игроков
    room.players.forEach(player => {
        player.hasAsked = false;
        player.hasBeenAsked = false;
        player.role = null;
        player.isSpy = false;
    });
    
    // Выбираем случайную локацию
    room.currentLocation = getRandomElement(room.locations);
    
    // Выбираем случайного шпиона
    const spyIndex = Math.floor(Math.random() * room.players.length);
    room.spyId = room.players[spyIndex].id;
    
    // Устанавливаем роли игрокам
    room.players.forEach(player => {
        player.isSpy = player.id === room.spyId;
        player.role = player.isSpy ? 'spy' : 'civilian';
    });
    
    // Выбираем случайного игрока (не шпиона) для первого хода
    const nonSpyPlayers = room.players.filter(p => p.id !== room.spyId);
    if (nonSpyPlayers.length === 0) return;
    
    const firstPlayerIndex = Math.floor(Math.random() * nonSpyPlayers.length);
    room.currentTurnPlayerId = nonSpyPlayers[firstPlayerIndex].id;
    const firstPlayer = room.players.find(p => p.id === room.currentTurnPlayerId);
    
    // Запускаем таймер
    startTurnTimer(room, room.turnTime, 'question');
    
    // Отправляем информацию о начале игры каждому игроку
    room.players.forEach(player => {
        const socket = io.sockets.sockets.get(player.id);
        if (socket) {
            socket.emit('game_started', {
                playerRole: player.role,
                location: player.isSpy ? null : room.currentLocation,
                timerDuration: room.turnTime,
                currentTurnPlayerId: room.currentTurnPlayerId,
                currentTurnPlayerName: firstPlayer ? firstPlayer.name : '-'
            });
        }
    });
    
    // Отправляем системное сообщение
    io.to(room.code).emit('system_message', {
        message: `Игра началась! Первым задает вопрос ${firstPlayer ? firstPlayer.name : '-'}.`
    });
}

// Функция запуска таймера хода
function startTurnTimer(room, duration, timerType) {
    clearInterval(room.timerInterval);
    
    let timeLeft = duration;
    updateTimerForRoom(room, timeLeft);
    
    room.timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerForRoom(room, timeLeft);
        
        if (timeLeft <= 0) {
            clearInterval(room.timerInterval);
            // Время вышло
            io.to(room.code).emit('time_up_notification', {
                timerType: timerType
            });
            
            // Автоматически передаем событие о таймауте
            io.to(room.code).emit('system_message', {
                message: 'Время вышло!'
            });
        }
    }, 1000);
}

// Функция обновления таймера для комнаты
function updateTimerForRoom(room, timeLeft) {
    io.to(room.code).emit('timer_update', timeLeft);
}

// Функция начала голосования
function startVoting(room) {
    clearInterval(room.timerInterval);
    
    io.to(room.code).emit('start_voting');
    io.to(room.code).emit('system_message', {
        message: 'Начинается голосование! Проголосуйте за игрока, который, по вашему мнению, является шпионом.'
    });
    
    // Запускаем таймер для голосования (1 минута)
    startTurnTimer(room, 60, 'vote');
}

// Функция завершения игры
function endGame(room, spyWins) {
    if (room.gameEnded) return;
    
    room.gameEnded = true;
    room.roundActive = false;
    clearInterval(room.timerInterval);
    
    // Находим имя шпиона
    const spyPlayer = room.players.find(p => p.id === room.spyId);
    const spyName = spyPlayer ? spyPlayer.name : 'Неизвестно';
    
    // Определяем победителя
    const winner = spyWins ? 'spies' : 'civilians';
    
    try {
        room.players.forEach(player => {
            if (player.userId) {
                const wasSpy = player.id === room.spyId;
                const won = (wasSpy && spyWins) || (!wasSpy && !spyWins);
                const stats = db.prepare('SELECT * FROM user_stats WHERE user_id = ?').get(player.userId);
                const delta = won ? 25 : -15;
                const newRating = Math.max(0, (stats?.rating ?? 0) + delta);
                if (stats) {
                    db.prepare(`
                        UPDATE user_stats SET 
                            games_played = games_played + 1,
                            games_won_as_spy = games_won_as_spy + ?,
                            games_won_as_civilian = games_won_as_civilian + ?,
                            games_lost = games_lost + ?,
                            rating = ?
                        WHERE user_id = ?
                    `).run(
                        wasSpy && spyWins ? 1 : 0,
                        !wasSpy && !spyWins ? 1 : 0,
                        (wasSpy && !spyWins) || (!wasSpy && spyWins) ? 1 : 0,
                        newRating,
                        player.userId
                    );
                } else {
                    db.prepare('INSERT INTO user_stats (user_id, games_played, games_won_as_spy, games_won_as_civilian, games_lost, rating) VALUES (?, 1, ?, ?, ?, ?)').run(
                        player.userId,
                        wasSpy && spyWins ? 1 : 0,
                        !wasSpy && !spyWins ? 1 : 0,
                        (wasSpy && !spyWins) || (!wasSpy && spyWins) ? 1 : 0,
                        newRating
                    );
                }
                checkAndGrantAchievements(player.userId);
            }
        });
    } catch (err) {
        console.error('Ошибка обновления статистики:', err);
    }
    
    // Отправляем результаты игры
    io.to(room.code).emit('game_end', {
        winner: winner,
        location: room.currentLocation,
        spyName: spyName,
        spyWins: spyWins
    });
    
    // Отправляем системное сообщение
    io.to(room.code).emit('system_message', {
        message: 'Игра завершена! Через 10 секунд все игроки будут возвращены в лобби.'
    });
    
    // Возвращаем всех в лобби через 10 секунд
    setTimeout(() => {
        returnToLobby(room);
    }, 10000);
}

// Функция возврата в лобби
function returnToLobby(room) {
    // Сбрасываем состояние комнаты
    room.gameStarted = false;
    room.roundActive = false;
    room.votes = {};
    room.currentTurnPlayerId = null;
    room.earlyVoteRequests = 0;
    room.currentQuestion = null;
    room.questionChain = [];
    room.spyGuessedLocation = false;
    room.spyGuessing = false;
    room.spyGuessOptions = [];
    room.gameEnded = false;
    
    // Сбрасываем роли и флаги игроков
    room.players.forEach(player => {
        player.role = null;
        player.isSpy = false;
        player.hasAsked = false;
        player.hasBeenAsked = false;
    });
    
    // Находим хоста
    const host = room.players.find(p => p.isHost);
    
    // Уведомляем игроков о возвращении в лобби
    io.to(room.code).emit('return_to_lobby');
    
    // Обновляем список игроков в лобби
    io.to(room.code).emit('players_update', {
        players: room.players,
        hostName: host ? host.name : '-'
    });
    
    io.to(room.code).emit('system_message', {
        message: 'Игра завершена! Все игроки возвращены в лобби.'
    });
}

// Запуск сервера
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});