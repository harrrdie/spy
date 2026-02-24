// Глобальные переменные
let socket;
let playerName = "";
let currentUser = null;
let roomCode = "";
let playerId = "";
let playerRole = "";
let currentLocation = "";
let isHost = false;
let currentTurnPlayerId = null;
let isMyTurn = false;
let turnTimer = null;
let selectedPlayerForQuestion = null;
let selectedPlayerForVote = null;
let spyGuessOptions = [];
let currentTimerType = 'question';
let locationReminder = null;
let isModalOpen = false; // Флаг для отслеживания открытых модальных окон

const DEFAULT_LOCATIONS = [
    'Пляж', 'Ресторан', 'Библиотека', 'Школа', 'Больница',
    'Кинотеатр', 'Супермаркет', 'Аэропорт', 'Стадион', 'Музей',
    'Зоопарк', 'Театр', 'Офис', 'Банк', 'Кафе',
    'Парк развлечений', 'Гостиница', 'Университет', 'Бассейн', 'Горнолыжный курорт'
];
let locationsForGame = [...DEFAULT_LOCATIONS];

// DOM элементы
const connectionScreen = document.getElementById('connectionScreen');
const lobbyScreen = document.getElementById('lobbyScreen');
const gameScreen = document.getElementById('gameScreen');
const themeToggle = document.getElementById('themeToggle');
const playerNameInput = document.getElementById('playerName');
const roomCodeInput = document.getElementById('roomCode');
const joinRoomBtn = document.getElementById('joinRoom');
const createRoomBtn = document.getElementById('createRoom');
const pasteCodeBtn = document.getElementById('pasteCode');
const copyCodeBtn = document.getElementById('copyCode');
const copyRoomLinkBtn = document.getElementById('copyRoomLink');
const showRoomQrBtn = document.getElementById('showRoomQr');
const leaveLobbyBtn = document.getElementById('leaveLobby');
const startGameBtn = document.getElementById('startGame');
const playersList = document.getElementById('playersList');
const gamePlayersList = document.getElementById('gamePlayersList');
const socialChatMessages = document.getElementById('socialChatMessages');
const socialMessageInput = document.getElementById('socialMessageInput');
const sendSocialMessageBtn = document.getElementById('sendSocialMessage');
const spyGuessBtn = document.getElementById('spyGuessBtn');
const initiateVoteBtn = document.getElementById('initiateVote');
const locationHintEl = document.getElementById('locationHint');
const playerRoleEl = document.getElementById('playerRole');
const currentTurnEl = document.getElementById('currentTurn');
const timerEl = document.getElementById('timer');
const roomCodeDisplay = document.getElementById('roomCodeDisplay');
const playerCount = document.getElementById('playerCount');
const hostNameEl = document.getElementById('hostName');
const locationsListEl = document.getElementById('locationsList');
const addLocationBtn = document.getElementById('addLocationBtn');
const addLocationModal = document.getElementById('addLocationModal');
const newLocationNameInput = document.getElementById('newLocationName');
const addLocationConfirmBtn = document.getElementById('addLocationConfirmBtn');
const closeAddLocationBtn = document.getElementById('closeAddLocationBtn');
const myLocationsSection = document.getElementById('myLocationsSection');
const myLocationsList = document.getElementById('myLocationsList');
const addImagesToLocationSection = document.getElementById('addImagesToLocationSection');
const newLocationImageUrl = document.getElementById('newLocationImageUrl');
const addLocationImageUrlBtn = document.getElementById('addLocationImageUrlBtn');
const pickExistingImagesBtn = document.getElementById('pickExistingImagesBtn');
const existingImagesPicker = document.getElementById('existingImagesPicker');
const locationImageFile = document.getElementById('locationImageFile');
const uploadLocationImageBtn = document.getElementById('uploadLocationImageBtn');
let currentAddingLocationId = null;
const connectionStatus = document.getElementById('connectionStatus');
const turnHistory = document.getElementById('turnHistory');

// Модальные окна
const playerSelectModal = document.getElementById('playerSelectModal');
const playerOptions = document.getElementById('playerOptions');
const cancelSelectionBtn = document.getElementById('cancelSelection');
const modalTitle = document.getElementById('modalTitle');
const modalDescription = document.getElementById('modalDescription');

const questionModal = document.getElementById('questionModal');
const questionModalTitle = document.getElementById('questionModalTitle');
const targetPlayerName = document.getElementById('targetPlayerName');
const questionInput = document.getElementById('questionInput');
const submitQuestionBtn = document.getElementById('submitQuestion');
const cancelQuestionBtn = document.getElementById('cancelQuestion');

const answerModal = document.getElementById('answerModal');
const askerPlayerName = document.getElementById('askerPlayerName');
const questionDisplay = document.getElementById('questionDisplay');
const answerInput = document.getElementById('answerInput');
const submitAnswerBtn = document.getElementById('submitAnswer');

const voteModal = document.getElementById('voteModal');
const voteDescription = document.getElementById('voteDescription');
const votePlayerOptions = document.getElementById('votePlayerOptions');
const submitVoteBtn = document.getElementById('submitVote');
const cancelVoteBtn = document.getElementById('cancelVote');

const spyGuessModal = document.getElementById('spyGuessModal');
const spyGuessOptionsContainer = document.getElementById('spyGuessOptions');
const closeSpyGuessBtn = document.getElementById('closeSpyGuess');

const finalResultsModal = document.getElementById('finalResultsModal');
const finalResultsTitle = document.getElementById('finalResultsTitle');
const finalResultsBody = document.getElementById('finalResultsBody');
const finalResultsIcon = document.getElementById('finalResultsIcon');
const closeFinalResultsBtn = document.getElementById('closeFinalResults');
const backToMainBtn = document.getElementById('backToMainBtn');

// QR-код приглашения
const qrModal = document.getElementById('qrModal');
const qrCodeContainer = document.getElementById('qrCodeContainer');
const qrCodeImage = document.getElementById('qrCodeImage');
const qrInviteLink = document.getElementById('qrInviteLink');
const closeQrBtn = document.getElementById('closeQr');

// Модальное окно для просмотра картинки локации
const locationImageViewerModal = document.getElementById('locationImageViewerModal');
const locationImageViewerImage = document.getElementById('locationImageViewerImage');
const closeLocationImageViewerBtn = document.getElementById('closeLocationImageViewer');

const errorContainer = document.getElementById('errorContainer');
const lobbyErrorContainer = document.getElementById('lobbyErrorContainer');

// Аудио элементы
const buttonSound = document.getElementById('buttonSound');
const winSound = document.getElementById('winSound');
const loseSound = document.getElementById('loseSound');

// Инициализация
document.addEventListener('DOMContentLoaded', async function() {
    // Установка соединения с сервером
    socket = io();
    
    // Обработчики событий
    setupEventListeners();
    setupSocketListeners();
    
    // Если открыта ссылка /room/CODE — подставляем код комнаты
    const pathMatch = window.location.pathname.match(/^\/room\/([A-Za-z0-9]+)\/?$/);
    if (pathMatch && roomCodeInput) {
        roomCodeInput.value = pathMatch[1].toUpperCase();
    }
    
    // Проверка авторизации
    try {
        const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
        const data = await res.json();
        if (data.user) {
            currentUser = data.user;
            const loginLink = document.getElementById('loginLink');
            const profileLink = document.getElementById('profileLink');
            const logoutLink = document.getElementById('logoutLink');
            const userDisplayName = document.getElementById('userDisplayName');
            const adminLink = document.getElementById('adminLink');
            if (loginLink) loginLink.style.display = 'none';
            if (profileLink) {
                profileLink.href = '/profile/' + data.user.id;
                profileLink.style.display = 'inline-flex';
            }
            if (userDisplayName) userDisplayName.textContent = data.user.display_name || data.user.username;
            if (adminLink && data.user.is_admin) {
                adminLink.style.display = 'inline';
            }
            if (logoutLink) {
                logoutLink.style.display = 'inline';
                logoutLink.onclick = async (e) => {
                    e.preventDefault();
                    await fetch('/api/auth/logout', { method: 'POST' });
                    window.location.reload();
                };
            }
            const notificationsWrap = document.getElementById('notificationsWrap');
            if (notificationsWrap) notificationsWrap.style.display = 'block';
            const notificationsBell = document.getElementById('notificationsBell');
            const notificationsDropdown = document.getElementById('notificationsDropdown');
            const notificationsBadge = document.getElementById('notificationsBadge');
            // Обновляем счетчик уведомлений при загрузке
            (async () => {
                try {
                    const res = await fetch('/api/profile/notifications/list', { credentials: 'same-origin' });
                    const data = await res.json();
                    const unread = (data.notifications || []).filter(n => !n.read_at).length;
                    if (notificationsBadge) {
                        if (unread > 0) {
                            notificationsBadge.textContent = unread > 99 ? '99+' : unread.toString();
                            notificationsBadge.style.display = 'flex';
                        } else {
                            notificationsBadge.textContent = '';
                            notificationsBadge.style.display = 'none';
                        }
                    }
                } catch (e) {}
            })();
            if (notificationsBell && notificationsDropdown) {
                notificationsBell.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (notificationsDropdown.style.display === 'block') {
                        notificationsDropdown.style.display = 'none';
                        return;
                    }
                    try {
                        const res = await fetch('/api/profile/notifications/list', { credentials: 'same-origin' });
                        const data = await res.json();
                        const list = data.notifications || [];
                        let unread = 0;
                        let html = '<div style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.1);display:flex;justify-content:space-between;align-items:center;"><strong>Уведомления</strong><button id="deleteAllNotificationsBtn" style="background:none;border:none;color:#ff6b6b;cursor:pointer;font-size:0.85rem;">Удалить все</button></div>';
                        if (list.length) {
                            list.forEach(n => {
                                if (!n.read_at) unread++;
                                let msg = '';
                                let actions = '';
                                if (n.type === 'friend_request') {
                                    msg = ' хочет добавить вас в друзья';
                                    actions = `<button class="accept-friend-btn" data-user-id="${n.data.from_user_id}" style="background:#4cd964;border:none;color:white;padding:4px 8px;border-radius:4px;cursor:pointer;margin-right:4px;font-size:0.85rem;">Принять</button><button class="reject-friend-btn" data-user-id="${n.data.from_user_id}" style="background:#ff6b6b;border:none;color:white;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:0.85rem;">Отклонить</button>`;
                                } else if (n.type === 'friend_accepted') {
                                    msg = ' принял заявку в друзья';
                                } else if (n.type === 'profile_like') {
                                    msg = ' лайкнул ваш профиль';
                                } else if (n.type === 'comment') {
                                    msg = ' оставил комментарий';
                                } else if (n.type === 'game_invite') {
                                    msg = ' приглашает вас в игру';
                                    const roomCode = n.data.room_code || '';
                                    actions = `<button class="accept-invite-btn" data-room-code="${roomCode}" style="background:#4cd964;border:none;color:white;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:0.85rem;">Принять</button>`;
                                }
                                const from = n.from_name ? escapeHtmlForDisplay(n.from_name) : 'Кто-то';
                                const link = (n.data && n.data.from_user_id) ? '/profile/' + n.data.from_user_id : '#';
                                const bgColor = n.read_at ? 'rgba(255,255,255,0.02)' : 'rgba(77,184,255,0.1)';
                                html += `<div style="display:flex;align-items:center;padding:10px 12px;background:${bgColor};border-bottom:1px solid rgba(255,255,255,0.06);" data-notif-id="${n.id}">
                                    <a href="${link}" style="flex:1;color:inherit;text-decoration:none;" data-id="${n.id}">
                                        <strong>${from}</strong>${msg}<br><small style="color:#888">${new Date(n.created_at).toLocaleString('ru')}</small>
                                    </a>
                                    <div style="display:flex;align-items:center;gap:4px;">${actions}<button class="delete-notif-btn" data-id="${n.id}" style="background:none;border:none;color:#ff6b6b;cursor:pointer;padding:4px 8px;margin-left:4px;" title="Удалить">×</button></div>
                                </div>`;
                            });
                        } else {
                            html += '<div style="padding:12px;color:#888;text-align:center;">Нет уведомлений</div>';
                        }
                        notificationsDropdown.innerHTML = html;
                        notificationsDropdown.style.display = 'block';
                        if (notificationsBadge) {
                            if (unread > 0) {
                                notificationsBadge.textContent = unread > 99 ? '99+' : unread.toString();
                                notificationsBadge.style.display = 'flex';
                            } else {
                                notificationsBadge.textContent = '';
                                notificationsBadge.style.display = 'none';
                            }
                        }
                        notificationsDropdown.querySelectorAll('a[data-id]').forEach(a => {
                            a.addEventListener('click', () => {
                                fetch('/api/profile/notifications/' + a.dataset.id + '/read', { method: 'PATCH', credentials: 'same-origin' }).catch(() => {});
                            });
                        });
                        notificationsDropdown.querySelectorAll('.accept-friend-btn').forEach(btn => {
                            btn.addEventListener('click', async (e) => {
                                e.stopPropagation();
                                const userId = parseInt(btn.dataset.userId);
                                try {
                                    await fetch(`/api/profile/${userId}/friend`, { method: 'POST', credentials: 'same-origin' });
                                    btn.closest('[data-notif-id]').remove();
                                    const remaining = notificationsDropdown.querySelectorAll('[data-notif-id]').length;
                                    if (remaining === 0) {
                                        notificationsDropdown.innerHTML = '<div style="padding:12px;color:#888;text-align:center;">Нет уведомлений</div>';
                                    }
                                } catch (e) {}
                            });
                        });
                        notificationsDropdown.querySelectorAll('.reject-friend-btn').forEach(btn => {
                            btn.addEventListener('click', async (e) => {
                                e.stopPropagation();
                                const userId = parseInt(btn.dataset.userId);
                                try {
                                    await fetch(`/api/profile/${userId}/friend/reject`, { method: 'POST', credentials: 'same-origin' });
                                    btn.closest('[data-notif-id]').remove();
                                    const remaining = notificationsDropdown.querySelectorAll('[data-notif-id]').length;
                                    if (remaining === 0) {
                                        notificationsDropdown.innerHTML = '<div style="padding:12px;color:#888;text-align:center;">Нет уведомлений</div>';
                                    }
                                } catch (e) {}
                            });
                        });
                        notificationsDropdown.querySelectorAll('.accept-invite-btn').forEach(btn => {
                            btn.addEventListener('click', async (e) => {
                                e.stopPropagation();
                                const roomCode = btn.dataset.roomCode;
                                if (roomCode) {
                                    window.location.href = '/room/' + roomCode;
                                }
                            });
                        });
                        notificationsDropdown.querySelectorAll('.delete-notif-btn').forEach(btn => {
                            btn.addEventListener('click', async (e) => {
                                e.stopPropagation();
                                const id = btn.dataset.id;
                                try {
                                    await fetch('/api/profile/notifications/' + id, { method: 'DELETE', credentials: 'same-origin' });
                                    btn.closest('[data-notif-id]').remove();
                                    const remaining = notificationsDropdown.querySelectorAll('[data-notif-id]').length;
                                    if (remaining === 0) {
                                        notificationsDropdown.innerHTML = '<div style="padding:12px;color:#888;text-align:center;">Нет уведомлений</div>';
                                    }
                                    const res = await fetch('/api/profile/notifications/list', { credentials: 'same-origin' });
                                    const d = await res.json();
                                    const unreadCount = (d.notifications || []).filter(n => !n.read_at).length;
                                    if (notificationsBadge) {
                                        if (unreadCount > 0) {
                                            notificationsBadge.textContent = unreadCount > 99 ? '99+' : unreadCount.toString();
                                            notificationsBadge.style.display = 'flex';
                                        } else {
                                            notificationsBadge.textContent = '';
                                            notificationsBadge.style.display = 'none';
                                        }
                                    }
                                } catch (e) {}
                            });
                        });
                        const deleteAllBtn = document.getElementById('deleteAllNotificationsBtn');
                        if (deleteAllBtn) {
                            deleteAllBtn.addEventListener('click', async (e) => {
                                e.stopPropagation();
                                if (!confirm('Удалить все уведомления?')) return;
                                try {
                                    await fetch('/api/profile/notifications', { method: 'DELETE', credentials: 'same-origin' });
                                    notificationsDropdown.innerHTML = '<div style="padding:12px;color:#888;text-align:center;">Нет уведомлений</div>';
                                    if (notificationsBadge) {
                                        notificationsBadge.style.display = 'none';
                                    }
                                } catch (e) {}
                            });
                        }
                    } catch (err) {
                        notificationsDropdown.innerHTML = '<div style="padding:12px;color:#888;">Ошибка загрузки</div>';
                        notificationsDropdown.style.display = 'block';
                    }
                });
                document.addEventListener('click', () => {
                    if (notificationsDropdown) notificationsDropdown.style.display = 'none';
                });
            }
            const displayName = data.user.display_name || data.user.username;
            playerNameInput.value = displayName;
            const nameGroup = document.getElementById('playerNameGroup');
            const authGroup = document.getElementById('playerNameAuthGroup');
            const nameDisplay = document.getElementById('playerNameDisplay');
            if (nameGroup && authGroup && nameDisplay) {
                nameGroup.style.display = 'none';
                authGroup.style.display = 'block';
                nameDisplay.textContent = displayName;
            }
        }
    } catch (e) { /* игнор */ }
    
    if (!currentUser) {
        const savedName = localStorage.getItem('spyPlayerName');
        if (savedName) playerNameInput.value = savedName;
    }
    
    // Поиск пользователей по юзернейму
    const headerSearch = document.getElementById('headerSearch');
    const headerSearchResults = document.getElementById('headerSearchResults');
    if (headerSearch && headerSearchResults) {
        let searchTimeout;
        headerSearch.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            const q = headerSearch.value.trim();
            if (q.length < 2) {
                headerSearchResults.style.display = 'none';
                headerSearchResults.innerHTML = '';
                return;
            }
            searchTimeout = setTimeout(async () => {
                try {
                    const res = await fetch('/api/profile/search?q=' + encodeURIComponent(q));
                    const data = await res.json();
                    headerSearchResults.innerHTML = '';
                    if (data.users && data.users.length > 0) {
                        data.users.forEach(u => {
                            const a = document.createElement('a');
                            a.href = '/profile/' + u.id;
                            a.className = 'search-result-item';
                            a.style.cssText = 'display: flex; align-items: center; gap: 12px; padding: 10px 12px; color: inherit; text-decoration: none; border-bottom: 1px solid rgba(255,255,255,0.06);';
                            a.innerHTML = '<img src="https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(u.avatar_seed || u.username) + '&backgroundColor=4db8ff" style="width:36px;height:36px;border-radius:50%;object-fit:cover;"><div><strong>' + escapeHtmlForDisplay(u.display_name || u.username) + '</strong><br><small style="color:#888">@' + escapeHtmlForDisplay(u.username) + '</small></div>';
                            headerSearchResults.appendChild(a);
                        });
                        headerSearchResults.style.display = 'block';
                    } else {
                        headerSearchResults.innerHTML = '<div style="padding:12px;color:#888;">Никого не найдено</div>';
                        headerSearchResults.style.display = 'block';
                    }
                } catch (e) {
                    headerSearchResults.style.display = 'none';
                }
            }, 300);
        });
        headerSearch.addEventListener('focus', () => { if (headerSearchResults.innerHTML) headerSearchResults.style.display = 'block'; });
        document.addEventListener('click', (e) => {
            if (!headerSearch.contains(e.target) && !headerSearchResults.contains(e.target))
                headerSearchResults.style.display = 'none';
        });
    }
    
    // Настройка переключателя темы
    const savedTheme = localStorage.getItem('spyTheme');
    if (savedTheme === 'light') {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
        themeToggle.checked = true;
    }

    const soundToggleBtn = document.getElementById('soundToggleBtn');
    if (soundToggleBtn) {
        // Устанавливаем начальное состояние
        const icon = soundToggleBtn.querySelector('i');
        if (soundEnabled) {
            icon.className = 'fas fa-volume-up';
            soundToggleBtn.classList.remove('sound-off');
        } else {
            icon.className = 'fas fa-volume-mute';
            soundToggleBtn.classList.add('sound-off');
        }
        
        soundToggleBtn.addEventListener('click', toggleSound);
    }
});

// Настройка обработчиков событий DOM
function setupEventListeners() {
    // Переключение темы
    themeToggle.addEventListener('change', toggleTheme);
    
    // Присоединение к комнате
    joinRoomBtn.addEventListener('click', joinRoom);
    
    // Создание комнаты
    createRoomBtn.addEventListener('click', createRoom);
    
    // Вставить код из буфера
    pasteCodeBtn.addEventListener('click', pasteFromClipboard);
    
    // Копировать код комнаты
    copyCodeBtn.addEventListener('click', () => {
        const code = roomCodeDisplay.textContent;
        if (code && code !== '----') {
            navigator.clipboard.writeText(code).then(() => {
                showCopyNotification('Код комнаты скопирован!');
            }).catch(() => {
                showError('Не удалось скопировать код');
            });
        }
    });
    // Копировать ссылку на комнату
    if (copyRoomLinkBtn) {
        copyRoomLinkBtn.addEventListener('click', copyRoomCode);
    }

    // Показать QR-код приглашения
    if (showRoomQrBtn && qrModal && qrCodeContainer && closeQrBtn) {
        showRoomQrBtn.addEventListener('click', () => {
            generateRoomQrCode();
            qrModal.classList.add('active');
        });

        closeQrBtn.addEventListener('click', () => {
            qrModal.classList.remove('active');
        });
    }
    
    // Покинуть лобби
    leaveLobbyBtn.addEventListener('click', leaveLobby);
    
    // Начать игру
    startGameBtn.addEventListener('click', startGame);
    
    // Локации: добавить
    if (addLocationBtn && addLocationModal) {
        addLocationBtn.addEventListener('click', () => {
            if (!isHost) return;
            newLocationNameInput.value = '';
            currentAddingLocationId = null;
            if (addImagesToLocationSection) addImagesToLocationSection.style.display = 'none';
            myLocationsSection.style.display = currentUser ? 'block' : 'none';
            if (currentUser && myLocationsList) {
                fetch('/api/locations', { credentials: 'same-origin' })
                    .then(r => r.json())
                    .then(data => {
                        myLocationsList.innerHTML = '';
                        (data.custom || []).forEach(loc => {
                            const btn = document.createElement('button');
                            btn.type = 'button';
                            btn.className = 'btn-secondary';
                            btn.style.cssText = 'margin-right: 8px; margin-bottom: 8px; word-wrap: break-word; overflow-wrap: break-word; white-space: normal; max-width: 100%;';
                            btn.textContent = loc.name;
                            btn.addEventListener('click', () => {
                                if (!locationsForGame.includes(loc.name)) {
                                    locationsForGame.push(loc.name);
                                    renderLocationsList();
                                }
                                addLocationModal.classList.remove('active');
                            });
                            myLocationsList.appendChild(btn);
                        });
                    })
                    .catch(() => {});
            }
            addLocationModal.classList.add('active');
        });
    }
    if (addLocationConfirmBtn && newLocationNameInput) {
        addLocationConfirmBtn.addEventListener('click', async () => {
            const name = newLocationNameInput.value.trim();
            if (!name) return;
            if (!locationsForGame.includes(name)) {
                locationsForGame.push(name);
                renderLocationsList();
            }
            if (currentUser) {
                try {
                    const r = await fetch('/api/locations', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name }),
                        credentials: 'same-origin'
                    });
                    const data = await r.json();
                    if (data.success && data.location) {
                        currentAddingLocationId = data.location.id;
                        if (addImagesToLocationSection) {
                            addImagesToLocationSection.style.display = 'block';
                            addImagesToLocationSection.dataset.locationName = name;
                        }
                        newLocationNameInput.value = '';
                        if (newLocationImageUrl) newLocationImageUrl.value = '';
                        if (existingImagesPicker) existingImagesPicker.innerHTML = '';
                        if (existingImagesPicker) existingImagesPicker.style.display = 'none';
                        return;
                    }
                } catch (e) { /* ignore */ }
            }
            newLocationNameInput.value = '';
            currentAddingLocationId = null;
            if (addImagesToLocationSection) addImagesToLocationSection.style.display = 'none';
            addLocationModal.classList.remove('active');
        });
    }
    if (uploadLocationImageBtn && locationImageFile) {
        uploadLocationImageBtn.addEventListener('click', async () => {
            const file = locationImageFile.files[0];
            if (!file || !currentAddingLocationId) return;
            const formData = new FormData();
            formData.append('image', file);
            try {
                await fetch('/api/locations/' + currentAddingLocationId + '/images/upload', {
                    method: 'POST',
                    body: formData,
                    credentials: 'same-origin'
                });
                locationImageFile.value = '';
                showCopyNotification('Изображение загружено!');
            } catch (e) {
                showError('Ошибка загрузки изображения');
            }
        });
    }
    if (addLocationImageUrlBtn && newLocationImageUrl) {
        addLocationImageUrlBtn.addEventListener('click', async () => {
            const url = newLocationImageUrl.value.trim();
            if (!url || !currentAddingLocationId) return;
            try {
                await fetch('/api/locations/' + currentAddingLocationId + '/images', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image_url: url }),
                    credentials: 'same-origin'
                });
                newLocationImageUrl.value = '';
            } catch (e) { /* ignore */ }
        });
    }
    if (pickExistingImagesBtn && existingImagesPicker) {
        pickExistingImagesBtn.addEventListener('click', async () => {
            if (!currentAddingLocationId) return;
            if (existingImagesPicker.style.display === 'block') {
                existingImagesPicker.style.display = 'none';
                existingImagesPicker.innerHTML = '';
                return;
            }
            try {
                const r = await fetch('/api/locations/images/all', { credentials: 'same-origin' });
                const data = await r.json();
                existingImagesPicker.innerHTML = '';
                (data.images || []).slice(0, 30).forEach(img => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'btn-secondary';
                    btn.style.margin = '4px';
                    btn.innerHTML = '<img src="' + img.image_url + '" style="width:40px;height:40px;object-fit:cover;border-radius:6px;vertical-align:middle;" onerror="this.style.display=\'none\'">';
                    btn.addEventListener('click', async () => {
                        await fetch('/api/locations/' + currentAddingLocationId + '/images/attach', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ image_id: img.id }),
                            credentials: 'same-origin'
                        });
                    });
                    existingImagesPicker.appendChild(btn);
                });
                existingImagesPicker.style.display = 'block';
            } catch (e) { existingImagesPicker.innerHTML = '<p style="color:#888;">Ошибка</p>'; existingImagesPicker.style.display = 'block'; }
        });
    }
    const doneAddingImagesBtn = document.getElementById('doneAddingImagesBtn');
    if (doneAddingImagesBtn && addLocationModal) {
        doneAddingImagesBtn.addEventListener('click', () => {
            currentAddingLocationId = null;
            if (addImagesToLocationSection) addImagesToLocationSection.style.display = 'none';
            addLocationModal.classList.remove('active');
        });
    }
    if (closeAddLocationBtn && addLocationModal) {
        closeAddLocationBtn.addEventListener('click', () => {
            currentAddingLocationId = null;
            if (addImagesToLocationSection) addImagesToLocationSection.style.display = 'none';
            addLocationModal.classList.remove('active');
        });
    }
    
    // Отправка сообщения в общий чат
    sendSocialMessageBtn.addEventListener('click', sendSocialMessage);
    socialMessageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') sendSocialMessage();
    });
    
    // Угадать локацию (для шпиона)
    spyGuessBtn.addEventListener('click', function() {
        if (playerRole === 'spy') {
            // Запрашиваем варианты для угадывания
            socket.emit('get_spy_guess_options', {
                roomCode: roomCode
            });
        }
    });
    
    // Инициировать голосование
    initiateVoteBtn.addEventListener('click', initiateEarlyVote);
    
    // Модальное окно выбора игрока
    cancelSelectionBtn.addEventListener('click', function() {
        playSound('button');
        closeAllModals();
    });
    
    // Модальное окно вопроса
    submitQuestionBtn.addEventListener('click', submitQuestion);
    cancelQuestionBtn.addEventListener('click', function() {
        playSound('button');
        closeAllModals();
    });
    
    // Модальное окно ответа
    submitAnswerBtn.addEventListener('click', submitAnswer);
    
    // Модальное окно голосования
    submitVoteBtn.addEventListener('click', submitVote);
    cancelVoteBtn.addEventListener('click', function() {
        playSound('button');
        closeAllModals();
    });
    
    // Закрыть модальное окно угадывания локации
    closeSpyGuessBtn.addEventListener('click', function() {
        playSound('button');
        closeAllModals();
    });
    
    // Закрыть финальное окно результатов
    closeFinalResultsBtn.addEventListener('click', function() {
        playSound('button');
        // Сбрасываем флаг
        isModalOpen = false;
        // Закрываем модальное окно
        finalResultsModal.classList.remove('active');
        
        // Явно скрываем фон модального окна
        finalResultsModal.style.display = 'none';
        
        // Перезапускаем игру в той же комнате
        setTimeout(() => {
            // Проверяем, что игрок все еще в игре
            if (roomCode && playerId) {
                // Отправляем событие перезапуска игры в ту же комнату
                socket.emit('restart_game_in_room', {
                    roomCode: roomCode
                });
            }
        }, 100);
    });
    
    // Звук при нажатии на любую кнопку
    document.addEventListener('click', function(e) {
        if (e.target.tagName === 'BUTTON' && !e.target.disabled && !e.target.classList.contains('kick-btn')) {
            playSound('button');
        }
    });
    
    // Кнопка "О сайте"
    const infoAboutSiteBtn = document.getElementById('infoAboutSiteBtn');
    const infoAboutSiteModal = document.getElementById('infoAboutSiteModal');
    const closeInfoAboutSiteBtn = document.getElementById('closeInfoAboutSiteBtn');
    if (infoAboutSiteBtn && infoAboutSiteModal) {
        infoAboutSiteBtn.addEventListener('click', () => {
            infoAboutSiteModal.classList.add('active');
        });
    }
    if (closeInfoAboutSiteBtn && infoAboutSiteModal) {
        closeInfoAboutSiteBtn.addEventListener('click', () => {
            infoAboutSiteModal.classList.remove('active');
        });
    }
    
    if (closeLocationImageViewerBtn && locationImageViewerModal) {
        closeLocationImageViewerBtn.addEventListener('click', () => {
            locationImageViewerModal.classList.remove('active');
        });
    }
    
    // Закрыть модальное окно при клике на фон
    if (locationImageViewerModal) {
        locationImageViewerModal.addEventListener('click', (e) => {
            if (e.target === locationImageViewerModal) {
                locationImageViewerModal.classList.remove('active');
            }
        });
    }
    
    // Кнопка "Вернуться на главную" на экране результатов
    if (backToMainBtn && finalResultsModal) {
        backToMainBtn.addEventListener('click', function() {
            playSound('button');
            // Сбрасываем флаг
            isModalOpen = false;
            // Закрываем модальное окно
            finalResultsModal.classList.remove('active');
            
            // Явно скрываем фон модального окна
            finalResultsModal.style.display = 'none';
            
            // Возвращаемся на главную страницу
            setTimeout(() => {
                // Проверяем, что игрок все еще в игре
                if (roomCode && playerId) {
                    // Отправляем команду о выходе
                    socket.emit('leave_room');
                }
                // Перенаправляем на главную страницу
                window.location.href = window.location.origin + '/';
            }, 100);
        });
    }
}

// Настройка обработчиков событий Socket.io
function setupSocketListeners() {
    // Подключение к серверу
    socket.on('connect', function() {
        console.log('Подключено к серверу');
        updateConnectionStatus(true);
    });
    
    // Отключение от сервера
    socket.on('disconnect', function() {
        console.log('Отключено от сервера');
        updateConnectionStatus(false);
    });
    
    // Ошибка подключения
    socket.on('connect_error', function() {
        console.log('Ошибка подключения к серверу');
        updateConnectionStatus(false);
    });
    
    // Ошибка от сервера
    socket.on('error', function(data) {
        showError(data.message);
    });
    
    // Успешное присоединение к комнате
    socket.on('room_joined', function(data) {
        playerId = data.playerId;
        roomCode = data.roomCode;
        isHost = data.isHost;
        
        // Обновляем URL на /room/CODE
        if (window.history && window.history.pushState) {
            window.history.pushState(null, '', '/room/' + roomCode);
        }
        
        // Сохраняем имя игрока
        localStorage.setItem('spyPlayerName', playerName);
        
        // Переключаемся на экран лобби
        showScreen('lobbyScreen');
        
        // Обновляем информацию о комнате
        roomCodeDisplay.textContent = roomCode;
        playerCount.textContent = data.players.length;
        hostNameEl.textContent = data.hostName;
        
        // Обновляем список игроков
        updatePlayersList(data.players);
        
        // Загружаем друзей для приглашения (если авторизован)
        if (currentUser) {
            loadFriendsForInvite();
        }
        
        // Инициализируем список локаций для игры (только для хоста можно менять, но список показываем всем)
        locationsForGame = [...DEFAULT_LOCATIONS];
        renderLocationsList();
        
        // Активируем кнопку "Начать игру" если игрок - хост и игроков достаточно
        updateStartButton(data.players.length);
        
        // Добавляем системное сообщение
        addSystemMessage(`Вы присоединились к комнате ${roomCode}`);
        
        // Очищаем ошибки
        clearError();
    });
    
    // Обновление списка игроков
    socket.on('players_update', function(data) {
        playerCount.textContent = data.players.length;
        hostNameEl.textContent = data.hostName;
        updatePlayersList(data.players);
        updateStartButton(data.players.length);
    });
    
    // Начало игры
    socket.on('game_started', function(data) {
        if (window.history && window.history.pushState) {
            window.history.pushState(null, '', '/game/' + roomCode);
        }
        showScreen('gameScreen');
        
        // Устанавливаем роль игрока
        playerRole = data.playerRole;
        playerRoleEl.textContent = getRoleText(playerRole);
        
        // Если игрок - шпион, показываем локацию как "????"
        // Иначе показываем настоящую локацию с аватаркой
        if (playerRole === 'spy') {
            locationHintEl.innerHTML = '????';
            currentLocation = '';
        } else {
            currentLocation = data.location;
            (async () => {
                const avatarUrl = await getLocationAvatarUrl(data.location);
                locationHintEl.innerHTML = `<img src="${avatarUrl}" alt="" style="width: 24px; height: 24px; border-radius: 4px; object-fit: cover; vertical-align: middle; margin-right: 6px;" onerror="this.style.display='none'"> <strong>${escapeHtmlForDisplay(data.location)}</strong>`;
                // Make the location image clickable
                const img = locationHintEl.querySelector('img');
                makeLocationImageClickable(img);
            })();
        }
        
        // Обновляем информацию о ходе
        currentTurnEl.textContent = data.currentTurnPlayerName;
        currentTurnPlayerId = data.currentTurnPlayerId;
        isMyTurn = data.currentTurnPlayerId === playerId;
        
        // Показываем/скрываем секцию для шпиона
        document.getElementById('spyActionSection').style.display = 
            playerRole === 'spy' ? 'block' : 'none';
        
        // Очищаем историю ходов
        turnHistory.innerHTML = '';
        
        // Очищаем чат
        socialChatMessages.innerHTML = '';
        
        // Закрываем все модальные окна
        closeAllModals();
        
        // Добавляем системное сообщение
        addSystemMessage(`Игра началась! Вы - ${getRoleText(playerRole)}. Локация: ${playerRole === 'spy' ? '????' : data.location}`);
        
        // Создаем напоминание о локации для не-шпиона
        createLocationReminder();
        
        // Если это наш ход, запрашиваем список доступных игроков
        if (isMyTurn) {
            setTimeout(() => {
                requestAvailablePlayers();
            }, 1000);
        }
        
        // Запускаем таймер
        startTimer(data.timerDuration);
    });
    
    // Получение списка доступных игроков
    socket.on('available_players', function(data) {
        if (isMyTurn) {
            showPlayerSelectModal('Выберите игрока, которому хотите задать вопрос', data.players);
        }
    });
    
    // Получение вопроса
    socket.on('receive_question', function(data) {
        currentTurnEl.textContent = 'Ваш ход';
        isMyTurn = true;
        currentTimerType = 'answer';
        
        // Показываем окно для ответа на вопрос
        showAnswerModal(data.askerName, data.question);
        
        // Сбрасываем таймер для ответа
        startTimer(60);
    });
    
    // Вопрос задан (для чата)
    socket.on('question_asked_chat', function(data) {
        // Добавляем вопрос в чат
        const isMyQuestion = data.askerId === playerId;
        addChatMessage(data.askerName, `задает вопрос игроку ${data.targetName}: "${data.question}"`, isMyQuestion, data.askerAvatarSeed);
        
        // Добавляем в историю ходов
        addTurnEvent(data.askerName, `задал вопрос игроку ${data.targetName}`);
        
        // Обновляем информацию о ходе
        currentTurnEl.textContent = data.targetName;
        const targetPlayer = Array.from(document.querySelectorAll('#gamePlayersList li')).find(li => 
            li.textContent.includes(data.targetName)
        );
        if (targetPlayer) {
            currentTurnPlayerId = targetPlayer.dataset.playerId;
        }
        isMyTurn = currentTurnPlayerId === playerId;
        
        if (isMyTurn) {
            currentTimerType = 'answer';
        }
        
        // Закрываем модальные окна
        closeAllModals();
    });
    
    // Ответ получен (для чата)
    socket.on('answer_received_chat', function(data) {
        // Добавляем ответ в чат
        const isMyAnswer = data.answererName === playerName;
        addChatMessage(data.answererName, `отвечает на вопрос "${data.question}" от ${data.askerName}: "${data.answer}"`, isMyAnswer, data.answererAvatarSeed);
        
        // Добавляем в историю ходов
        addTurnEvent(data.answererName, 'ответил на вопрос');
        
        // Закрываем модальные окна
        closeAllModals();
    });
    
    // Следующий ход
    socket.on('next_turn', function(data) {
        currentTurnEl.textContent = data.nextPlayerName;
        currentTurnPlayerId = data.nextPlayerId;
        isMyTurn = data.nextPlayerId === playerId;
        currentTimerType = 'question';
        
        // Закрываем все модальные окна
        closeAllModals();
        
        // Если это наш ход, запрашиваем список доступных игроков
        if (isMyTurn) {
            setTimeout(() => {
                requestAvailablePlayers();
            }, 1000);
        }
        
        // Сбрасываем таймер
        startTimer(60);
    });
    
    socket.on('new_social_message', function(data) {
        const sender = data.isGuest ? data.sender + ' (гость)' : data.sender;
        addChatMessage(sender, data.message, data.senderId === playerId, data.avatarSeed);
    });
    
    // Системное сообщение
    socket.on('system_message', function(data) {
        addSystemMessage(data.message);
    });
    
    // Обновление таймера
    socket.on('timer_update', function(timeLeft) {
        updateTimerDisplay(timeLeft);
    });
    
    // Уведомление о времени
    socket.on('time_up_notification', function(data) {
        // Закрываем все модальные окна
        closeAllModals();
        
        // Отправляем серверу, что время вышло
        socket.emit('time_up', {
            roomCode: roomCode,
            timerType: data.timerType
        });
    });
    
    // Начало голосования
    socket.on('start_voting', function() {
        // Обновляем информацию о ходе
        currentTurnEl.textContent = 'Голосование';
        isMyTurn = false;
        currentTimerType = 'vote';
        
        // Закрываем все модальные окна
        closeAllModals();
        
        // Показываем модальное окно голосования
        showVoteModal();
        
        // Сбрасываем таймер
        startTimer(60);
    });
    
    // Список игроков для голосования
    socket.on('vote_options', function(data) {
        showVoteOptions(data.players);
    });
    
    // Шпион пойман, нужно угадать локацию
    socket.on('spy_caught_guess', function(data) {
        if (playerRole === 'spy') {
            // Закрываем все модальные окна
            closeAllModals();
            
            // Запрашиваем варианты для угадывания
            socket.emit('get_spy_guess_options', {
                roomCode: roomCode
            });
            
            currentTimerType = 'spy_guess';
            startTimer(60);
        }
    });
    
    // Варианты для угадывания локации шпионом
    socket.on('spy_guess_options', function(data) {
        if (playerRole === 'spy') {
            spyGuessOptions = data.options;
            showSpyGuessModal();
        }
    });
    
    // Конец игры
    socket.on('game_end', function(data) {
        // Останавливаем таймер
        if (turnTimer) clearInterval(turnTimer);
        
        // Сбрасываем состояние игры
        isMyTurn = false;
        currentTurnPlayerId = null;
        currentTimerType = 'question';
        
        // Закрываем все модальные окна, кроме финальных результатов
        closeAllModals();
        
        // Показываем финальные результаты с небольшой задержкой
        setTimeout(() => {
            showFinalResults(data);
        }, 500);
    });
    
    // Возврат в лобби
    socket.on('return_to_lobby', function() {
        if (window.history && window.history.pushState) {
            window.history.pushState(null, '', '/room/' + roomCode);
        }
        showScreen('lobbyScreen');
        addSystemMessage('Игра завершена! Все игроки возвращены в лобби.');
        
        // Удаляем напоминание о локации
        if (locationReminder) {
            locationReminder.remove();
            locationReminder = null;
        }
        
        // Закрываем все модальные окна
        closeAllModals();
    });
    
    // Перезапуск игры в одной комнате
    socket.on('restart_game_ready', function(data) {
        if (window.history && window.history.pushState) {
            window.history.pushState(null, '', '/room/' + roomCode);
        }
        showScreen('lobbyScreen');
        addSystemMessage('Игра завершена! Вы вернулись в лобби. Хост может начать новую игру.');
        
        // Удаляем напоминание о локации
        if (locationReminder) {
            locationReminder.remove();
            locationReminder = null;
        }
        
        // Обновляем список игроков
        if (data.players) {
            updatePlayersList(data.players);
            playerCount.textContent = data.players.length;
            hostNameEl.textContent = data.hostName;
        }
        
        // Закрываем все модальные окна
        closeAllModals();
    });
    
    // Игрок был исключен
    socket.on('player_kicked', function(data) {
        if (data.kickedPlayerId === playerId) {
            showError('Вы были исключены из комнаты хостом');
            showScreen('connectionScreen');
            
            // Удаляем напоминание о локации
            if (locationReminder) {
                locationReminder.remove();
                locationReminder = null;
            }
            
            // Закрываем все модальные окна
            closeAllModals();
        } else {
            addSystemMessage(`${data.kickedPlayerName} был исключен из комнаты`);
        }
    });
}

// Функция переключения темы
function toggleTheme() {
    const body = document.body;
    
    if (themeToggle.checked) {
        body.classList.remove('dark-theme');
        body.classList.add('light-theme');
        localStorage.setItem('spyTheme', 'light');
    } else {
        body.classList.remove('light-theme');
        body.classList.add('dark-theme');
        localStorage.setItem('spyTheme', 'dark');
    }
}

// Функция присоединения к комнате
function joinRoom() {
    playerName = currentUser ? (currentUser.display_name || currentUser.username) : playerNameInput.value.trim();
    roomCode = roomCodeInput.value.trim().toUpperCase();
    
    if (!playerName) {
        showError('Пожалуйста, введите ваше имя');
        return;
    }
    
    if (!roomCode) {
        showError('Пожалуйста, введите код комнаты');
        return;
    }
    
    // Отправляем запрос на присоединение к комнате
    socket.emit('join_room', {
        playerName: playerName,
        roomCode: roomCode,
        userId: currentUser ? currentUser.id : null
    });
}

// Функция создания комнаты
function createRoom() {
    playerName = currentUser ? (currentUser.display_name || currentUser.username) : playerNameInput.value.trim();
    
    if (!playerName) {
        showError('Пожалуйста, введите ваше имя');
        return;
    }
    
    // Отправляем запрос на создание комнаты
    socket.emit('create_room', {
        playerName: playerName,
        userId: currentUser ? currentUser.id : null
    });
}

// Функция вставки из буфера
async function pasteFromClipboard() {
    try {
        const text = await navigator.clipboard.readText();
        roomCodeInput.value = text.trim().toUpperCase();
    } catch (err) {
        showError('Не удалось получить доступ к буферу обмена');
    }
}

// Функция копирования ссылки на комнату
function copyRoomCode() {
    const code = roomCodeDisplay.textContent;
    if (code && code !== '----') {
        const url = window.location.origin + '/room/' + code;
        navigator.clipboard.writeText(url).then(() => {
            showCopyNotification('Ссылка на комнату скопирована!');
        }).catch(() => {
            showError('Не удалось скопировать ссылку');
        });
    }
}

// Генерация QR-кода приглашения (серверный PNG)
function generateRoomQrCode() {
    if (!qrCodeContainer || !qrCodeImage || !roomCodeDisplay) return;
    const code = roomCodeDisplay.textContent;
    if (!code || code === '----') return;

    const inviteUrl = window.location.origin + '/room/' + code;
    const qrUrl = `/api/room/${encodeURIComponent(code)}/qr`;

    // Обновляем текст ссылки
    if (qrInviteLink) {
        qrInviteLink.textContent = inviteUrl;
    }

    // Устанавливаем src PNG-QR с сервера
    qrCodeImage.src = qrUrl;
}

// Функция выхода из лобби
function leaveLobby() {
    socket.emit('leave_room');
    if (window.history && window.history.pushState) {
        window.history.pushState(null, '', '/');
    }
    showScreen('connectionScreen');
    addSystemMessage('Вы покинули лобби');
    
    // Удаляем напоминание о локации
    if (locationReminder) {
        locationReminder.remove();
        locationReminder = null;
    }
    
    // Закрываем все модальные окна
    closeAllModals();
}

// Функция начала игры
function startGame() {
    const locations = locationsForGame.filter(loc => (loc || '').trim());
    
    if (locations.length < 5) {
        showLobbyError('Необходимо минимум 5 локаций для игры');
        return;
    }
    
    socket.emit('start_game', {
        roomCode: roomCode,
        locations: locations
    });
}

// Функция отправки сообщения в общий чат
function sendSocialMessage() {
    const message = socialMessageInput.value.trim();
    
    if (!message) return;
    
    socket.emit('send_social_message', {
        roomCode: roomCode,
        message: message
    });
    
    // Очищаем поле ввода
    socialMessageInput.value = '';
}

// Функция инициирования досрочного голосования
function initiateEarlyVote() {
    socket.emit('initiate_early_vote', {
        roomCode: roomCode
    });
}

// Функция запроса списка доступных игроков
function requestAvailablePlayers() {
    socket.emit('get_available_players', {
        roomCode: roomCode
    });
}

// Функция показа модального окна выбора игрока
function showPlayerSelectModal(description, availablePlayers) {
    modalTitle.textContent = 'Выберите игрока';
    modalDescription.textContent = description;
    
    // Добавляем подсказку с локацией для не-шпиона
    if (playerRole !== 'spy' && currentLocation) {
        (async () => {
            const avatarUrl = await getLocationAvatarUrl(currentLocation);
            modalDescription.innerHTML += `<br><small><i class="fas fa-map-marker-alt"></i> Локация: <img src="${avatarUrl}" alt="" style="width: 16px; height: 16px; border-radius: 3px; object-fit: cover; vertical-align: middle; margin: 0 4px; cursor: pointer;" title="Нажмите, чтобы увидеть локацию" onerror="this.style.display='none'"> <strong>${escapeHtmlForDisplay(currentLocation)}</strong></small>`;
            
            // Делаем картинку локации кликабельной
            const locationImg = modalDescription.querySelector('img[src="' + avatarUrl + '"]');
            if (locationImg) {
                makeLocationImageClickable(locationImg);
            }
        })();
    }
    
    playerOptions.innerHTML = '';
    
    if (availablePlayers && availablePlayers.length > 0) {
        availablePlayers.forEach(player => {
            if (player.id !== playerId) {
                const option = document.createElement('div');
                option.className = 'player-option';
                option.dataset.playerId = player.id;
                
                let playerInfo = `<i class="fas fa-user"></i><span>${player.name}</span>`;
                
                // Добавляем иконку, если игроку уже задавали вопрос
                if (player.hasBeenAsked) {
                    playerInfo += ` <i class="fas fa-comment-dots" style="color: #ffa502; margin-left: 5px;" title="Этому игроку уже задавали вопрос"></i>`;
                }
                
                option.innerHTML = playerInfo;
                
                option.addEventListener('click', function() {
                    const selectedId = this.dataset.playerId;
                    const selectedName = player.name;
                    selectPlayerForQuestion(selectedId, selectedName);
                });
                
                playerOptions.appendChild(option);
            }
        });
    } else {
        playerOptions.innerHTML = '<p>Нет доступных игроков для вопроса.</p>';
    }
    
    playerSelectModal.classList.add('active');
}

// Функция выбора игрока для вопроса
function selectPlayerForQuestion(playerId, playerName) {
    selectedPlayerForQuestion = { id: playerId, name: playerName };
    playerSelectModal.classList.remove('active');
    
    // Показываем окно для ввода вопроса
    showQuestionModal(playerName);
}

// Функция показа модального окна вопроса
function showQuestionModal(targetName) {
    questionModalTitle.textContent = 'Задайте вопрос';
    targetPlayerName.textContent = targetName;
    questionInput.value = '';
    questionModal.classList.add('active');
    questionInput.focus();
    
    // Добавляем подсказку с локацией для не-шпиона
    const modalBody = document.querySelector('#questionModal .modal-body');
    let locationHint = modalBody.querySelector('.location-hint');
    
    if (!locationHint) {
        locationHint = document.createElement('div');
        locationHint.className = 'location-hint';
        modalBody.insertBefore(locationHint, modalBody.firstChild);
    }
    
    if (playerRole !== 'spy' && currentLocation) {
        (async () => {
            const avatarUrl = await getLocationAvatarUrl(currentLocation);
            locationHint.innerHTML = `<p><i class="fas fa-map-marker-alt"></i> Локация: <img src="${avatarUrl}" alt="" style="width: 20px; height: 20px; border-radius: 4px; object-fit: cover; vertical-align: middle; margin: 0 6px;" onerror="this.style.display='none'"> <strong>${escapeHtmlForDisplay(currentLocation)}</strong></p>`;
            locationHint.style.display = 'block';
            // Make the location image clickable
            const img = locationHint.querySelector('img');
            makeLocationImageClickable(img);
        })();
    } else {
        locationHint.style.display = 'none';
    }
}

// Функция отправки вопроса
function submitQuestion() {
    const question = questionInput.value.trim();
    
    if (!question) {
        showError('Пожалуйста, введите вопрос');
        return;
    }
    
    if (!selectedPlayerForQuestion) {
        showError('Не выбран игрок для вопроса');
        return;
    }
    
    socket.emit('ask_question', {
        roomCode: roomCode,
        targetPlayerId: selectedPlayerForQuestion.id,
        question: question
    });
    
    questionModal.classList.remove('active');
    selectedPlayerForQuestion = null;
    
    // Сбрасываем таймер
    startTimer(60);
}

// Функция показа модального окна ответа
function showAnswerModal(askerName, question) {
    askerPlayerName.textContent = askerName;
    questionDisplay.textContent = question;
    answerInput.value = '';
    answerModal.classList.add('active');
    answerInput.focus();
    
    // Добавляем подсказку с локацией для не-шпиона
    const modalBody = document.querySelector('#answerModal .modal-body');
    let locationHint = modalBody.querySelector('.location-hint');
    
    if (!locationHint) {
        locationHint = document.createElement('div');
        locationHint.className = 'location-hint';
        modalBody.insertBefore(locationHint, modalBody.firstChild);
    }
    
    if (playerRole !== 'spy' && currentLocation) {
        (async () => {
            const avatarUrl = await getLocationAvatarUrl(currentLocation);
            locationHint.innerHTML = `<p><i class="fas fa-map-marker-alt"></i> Локация: <img src="${avatarUrl}" alt="" style="width: 20px; height: 20px; border-radius: 4px; object-fit: cover; vertical-align: middle; margin: 0 6px;" onerror="this.style.display='none'"> <strong>${escapeHtmlForDisplay(currentLocation)}</strong></p>`;
            locationHint.style.display = 'block';
            // Make the location image clickable
            const img = locationHint.querySelector('img');
            makeLocationImageClickable(img);
        })();
    } else {
        locationHint.style.display = 'none';
    }
}

// Функция отправки ответа
function submitAnswer() {
    const answer = answerInput.value.trim();
    
    if (!answer) {
        showError('Пожалуйста, введите ответ');
        return;
    }
    
    socket.emit('answer_question', {
        roomCode: roomCode,
        answer: answer
    });
    
    answerModal.classList.remove('active');
    
    // Сбрасываем таймер
    startTimer(60);
}

// Функция показа модального окна голосования
function showVoteModal() {
    voteDescription.textContent = 'Проголосуйте за игрока, который, по вашему мнению, является шпионом:';
    votePlayerOptions.innerHTML = '';
    
    // Добавляем подсказку с локацией для не-шпиона
    if (playerRole !== 'spy' && currentLocation) {
        (async () => {
            const avatarUrl = await getLocationAvatarUrl(currentLocation);
            voteDescription.innerHTML = `Проголосуйте за игрока, который, по вашему мнению, является шпионом:<br>
                                        <small><i class="fas fa-map-marker-alt"></i> Локация: <img src="${avatarUrl}" alt="" style="width: 16px; height: 16px; border-radius: 3px; object-fit: cover; vertical-align: middle; margin: 0 4px;" onerror="this.style.display='none'"> <strong>${escapeHtmlForDisplay(currentLocation)}</strong></small>`;
        })();
    }
    
    // Запрашиваем список игроков для голосования
    socket.emit('get_vote_options', {
        roomCode: roomCode
    });
    
    voteModal.classList.add('active');
}

// Функция показа вариантов для голосования
function showVoteOptions(players) {
    votePlayerOptions.innerHTML = '';
    selectedPlayerForVote = null;
    
    players.forEach(player => {
        const option = document.createElement('div');
        option.className = 'player-option';
        option.dataset.playerId = player.id;
        option.innerHTML = `
            <i class="fas fa-user"></i>
            <span>${player.name}</span>
        `;
        
        option.addEventListener('click', function() {
            // Снимаем выделение со всех вариантов
            document.querySelectorAll('#votePlayerOptions .player-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            
            // Выделяем выбранный вариант
            this.classList.add('selected');
            selectedPlayerForVote = this.dataset.playerId;
            submitVoteBtn.disabled = false;
        });
        
        votePlayerOptions.appendChild(option);
    });
    
    submitVoteBtn.disabled = true;
}

// Функция отправки голоса
function submitVote() {
    if (!selectedPlayerForVote) {
        showError('Пожалуйста, выберите игрока для голосования');
        return;
    }
    
    socket.emit('submit_vote', {
        roomCode: roomCode,
        votedPlayerId: selectedPlayerForVote
    });
    
    voteModal.classList.remove('active');
    selectedPlayerForVote = null;
    
    // Сбрасываем таймер
    startTimer(60);
}

// Функция показа модального окна для угадывания локации шпионом
function showSpyGuessModal() {
    spyGuessOptionsContainer.innerHTML = '';
    
    spyGuessOptions.forEach((option, index) => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'player-option';
        optionDiv.innerHTML = `
            <i class="fas fa-map-marker-alt"></i>
            <span>${option}</span>
        `;
        
        optionDiv.addEventListener('click', function() {
            // Отправляем выбранный вариант
            socket.emit('guess_location', {
                roomCode: roomCode,
                guess: option
            });
            
            spyGuessModal.classList.remove('active');
            
            // Сбрасываем таймер
            startTimer(60);
        });
        
        spyGuessOptionsContainer.appendChild(optionDiv);
    });
    
    spyGuessModal.classList.add('active');
}

// Функция исключения игрока
function kickPlayer(playerId, playerName) {
    if (confirm(`Вы уверены, что хотите исключить игрока ${playerName}?`)) {
        socket.emit('kick_player', {
            roomCode: roomCode,
            playerId: playerId
        });
    }
}

// Функция закрытия всех модальных окон
function closeAllModals() {
    const modals = [
        playerSelectModal,
        questionModal,
        answerModal,
        voteModal,
        spyGuessModal,
        qrModal
        // finalResultsModal не закрываем, так как это окно результатов
    ];
    
    modals.forEach(modal => {
        modal.classList.remove('active');
    });
    
    // Сбрасываем выбранных игроков
    selectedPlayerForQuestion = null;
    selectedPlayerForVote = null;
    
    // Сбрасываем флаг
    isModalOpen = false;
}

// Вспомогательные функции
function showScreen(screenId) {
    // Скрываем все экраны
    connectionScreen.classList.remove('active');
    lobbyScreen.classList.remove('active');
    gameScreen.classList.remove('active');
    
    // Удаляем напоминание о локации если выходим из игры
    if (screenId !== 'gameScreen' && locationReminder) {
        locationReminder.remove();
        locationReminder = null;
    }
    
    // Закрываем все модальные окна при смене экрана
    closeAllModals();
    
    // Показываем нужный экран
    document.getElementById(screenId).classList.add('active');
}

function escapeHtmlForDisplay(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

function getAvatarUrl(seed) {
    if (!seed) return 'https://api.dicebear.com/7.x/avataaars/svg?seed=default&backgroundColor=4db8ff';
    // Если это URL (начинается с /uploads/), возвращаем его
    if (seed.startsWith('/uploads/')) return seed;
    // Иначе используем dicebear
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}&backgroundColor=4db8ff`;
}

const DEFAULT_LOCATION_IMAGES = {
    'Пляж': '/uploads/locations/пляж.avif',
    'Ресторан': '/uploads/locations/ресторан.webp',
    'Библиотека': '/uploads/locations/библиотека.jpg',
    'Школа': '/uploads/locations/школа.jpeg',
    'Больница': '/uploads/locations/больница.jpg',
    'Кинотеатр': '/uploads/locations/кинотеатр.webp',
    'Супермаркет': '/uploads/locations/супермаркет.webp',
    'Аэропорт': '/uploads/locations/аэропорт.webp',
    'Стадион': '/uploads/locations/стадион.jpg',
    'Музей': '/uploads/locations/музей.jpg',
    'Зоопарк': '/uploads/locations/зоопарк.webp',
    'Театр': '/uploads/locations/театр.jpg',
    'Офис': '/uploads/locations/офис.jpg',
    'Банк': '/uploads/locations/банк.webp',
    'Кафе': '/uploads/locations/кафе.jpg',
    'Парк развлечений': '/uploads/locations/парк_развлечений.webp',
    'Гостиница': '/uploads/locations/гостиница.webp',
    'Университет': '/uploads/locations/университет.jpg',
    'Бассейн': '/uploads/locations/бассейн.webp',
    'Горнолыжный курорт': '/uploads/locations/горнолыжный_курорт.jpg'
};

function updatePlayersList(players) {
    // Обновляем список игроков в лобби
    playersList.innerHTML = '';
    
    players.forEach(player => {
        const li = document.createElement('li');
        
        const guestBadge = !player.userId ? ' <span class="guest-badge" title="Не авторизован">(гость)</span>' : '';
        const avatarUrl = player.avatarSeed ? getAvatarUrl(player.avatarSeed) : getAvatarUrl(player.name);
        const nameDisplay = player.userId 
            ? `<a href="/profile/${player.userId}" target="_blank" rel="noopener" style="color: inherit; text-decoration: none; font-weight: 600;">${escapeHtmlForDisplay(player.name)}</a>`
            : `<span>${escapeHtmlForDisplay(player.name)}</span>`;
        let playerContent = `
            <div class="player-info" style="display: flex; align-items: center; gap: 10px;">
                <img src="${avatarUrl}" alt="" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; flex-shrink: 0;">
                <div style="flex: 1;">
                    ${nameDisplay}${guestBadge}
                    ${player.isHost ? '<i class="fas fa-crown" title="Хост" style="margin-left: 5px;"></i>' : ''}
                </div>
            </div>
        `;
        
        // Добавляем кнопку исключения для хоста
        if (isHost && player.id !== playerId) {
            playerContent += `
                <div class="player-actions">
                    <button class="kick-btn" onclick="kickPlayer('${player.id}', '${player.name}')" title="Исключить">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        }
        
        li.innerHTML = playerContent;
        playersList.appendChild(li);
    });
    
    // Обновляем список игроков в игре
    gamePlayersList.innerHTML = '';
    
    players.forEach(player => {
        const li = document.createElement('li');
        li.className = 'online';
        li.dataset.playerId = player.id;
        const guestBadge = !player.userId ? ' <span class="guest-badge">(гость)</span>' : '';
        const avatarUrl = player.avatarSeed ? getAvatarUrl(player.avatarSeed) : getAvatarUrl(player.name);
        const namePart = player.userId
            ? `<a href="/profile/${player.userId}" target="_blank" rel="noopener" style="color: inherit; text-decoration: none; font-weight: 600;">${escapeHtmlForDisplay(player.name)}</a>`
            : `<span>${escapeHtmlForDisplay(player.name)}</span>`;
        li.innerHTML = `
            <img src="${avatarUrl}" alt="" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; margin-right: 8px; flex-shrink: 0;">
            ${namePart}${guestBadge}
            ${player.isHost ? '<i class="fas fa-crown" style="margin-left: 5px;"></i>' : ''}
        `;
        li.style.display = 'flex';
        li.style.alignItems = 'center';
        gamePlayersList.appendChild(li);
    });
}

function updateStartButton(playersCount) {
    if (playersCount < 3) {
        startGameBtn.disabled = true;
        showLobbyError('Необходимо минимум 3 игрока для начала игры');
    } else {
        startGameBtn.disabled = !isHost;
        clearLobbyError();
    }
    if (addLocationBtn) addLocationBtn.style.display = isHost ? 'inline-flex' : 'none';
}

async function loadFriendsForInvite() {
    try {
        const res = await fetch('/api/profile/friends/list', { credentials: 'same-origin' });
        const data = await res.json();
        const inviteSection = document.getElementById('inviteFriendsSection');
        const friendsList = document.getElementById('friendsToInviteList');
        if (!inviteSection || !friendsList) return;
        if (data.friends && data.friends.length > 0 && isHost) {
            inviteSection.style.display = 'block';
            friendsList.innerHTML = '';
            data.friends.forEach(f => {
                const btn = document.createElement('button');
                btn.className = 'btn-secondary';
                btn.style.cssText = 'display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; font-size: 0.9rem;';
                btn.innerHTML = `<img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(f.avatar_seed || f.username)}&backgroundColor=4db8ff" style="width:24px;height:24px;border-radius:50%;"> ${escapeHtmlForDisplay(f.display_name || f.username)}`;
                btn.addEventListener('click', async () => {
                    // Отправляем уведомление другу
                    try {
                        const res = await fetch('/api/profile/invite-to-game', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ friend_id: f.id, room_code: roomCode }),
                            credentials: 'same-origin'
                        });
                        const data = await res.json();
                        if (data.success) {
                            showCopyNotification(`Приглашение отправлено ${f.display_name || f.username}`);
                        } else {
                            showError(data.error || 'Ошибка отправки приглашения');
                        }
                    } catch (e) {
                        showError('Ошибка отправки приглашения');
                    }
                });
                friendsList.appendChild(btn);
            });
        } else {
            inviteSection.style.display = 'none';
        }
    } catch (e) {}
}

async function getLocationAvatarUrl(locationName) {
    // Сначала проверяем, есть ли картинка для стандартной локации
    if (DEFAULT_LOCATION_IMAGES[locationName]) {
        return DEFAULT_LOCATION_IMAGES[locationName];
    }

    try {
        // Пытаемся найти локацию в БД и получить её изображение
        const res = await fetch('/api/locations', { credentials: 'same-origin' });
        const data = await res.json();
        const customLoc = (data.custom || []).find(loc => loc.name === locationName);
        if (customLoc && customLoc.id) {
            const imgRes = await fetch(`/api/locations/${customLoc.id}/images`, { credentials: 'same-origin' });
            const imgData = await imgRes.json();
            if (imgData.images && imgData.images.length > 0) {
                return imgData.images[0].image_url;
            }
        }
    } catch (e) {
        // Игнорируем ошибки
    }
    // Дефолтная иконка
    return `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(locationName)}&backgroundColor=4db8ff`;
}

async function renderLocationsList() {
    if (!locationsListEl) return;
    locationsListEl.innerHTML = '';
    for (let idx = 0; idx < locationsForGame.length; idx++) {
        const name = locationsForGame[idx];
        const chip = document.createElement('span');
        chip.className = 'location-chip';
        chip.style.cssText = 'display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; margin: 4px; background: rgba(77,184,255,0.2); border-radius: 20px; font-size: 0.9rem; word-wrap: break-word; overflow-wrap: break-word; white-space: normal; max-width: 100%;';
        const avatarUrl = await getLocationAvatarUrl(name);
        chip.innerHTML = `<img src="${avatarUrl}" alt="" style="width: 20px; height: 20px; border-radius: 4px; object-fit: cover; flex-shrink: 0;" onerror="this.src='https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(name)}&backgroundColor=4db8ff'"> ${escapeHtmlForDisplay(name)}` + (isHost ? ' <button type="button" class="location-chip-remove" style="background:none;border:none;color:#ff6b6b;cursor:pointer;padding:0 4px;font-size:1rem;">&times;</button>' : '');
        
        // Make the location image clickable
        const img = chip.querySelector('img');
        makeLocationImageClickable(img);
        
        const removeBtn = chip.querySelector('.location-chip-remove');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                locationsForGame = locationsForGame.filter((_, i) => i !== idx);
                renderLocationsList();
            });
        }
        locationsListEl.appendChild(chip);
    }
}

function addSystemMessage(text) {
    addChatMessage('Система', text, false);
}

function addChatMessage(sender, text, isSentByMe = false, senderAvatarSeed = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    
    if (sender === 'Система') {
        messageDiv.classList.add('system');
    } else if (isSentByMe) {
        messageDiv.classList.add('sent');
    } else {
        messageDiv.classList.add('received');
    }
    
    if (sender !== 'Система') {
        const senderContainer = document.createElement('div');
        senderContainer.className = 'sender-container';
        senderContainer.style.display = 'flex';
        senderContainer.style.alignItems = 'center';
        senderContainer.style.gap = '8px';
        
        const avatarUrl = senderAvatarSeed ? getAvatarUrl(senderAvatarSeed) : getAvatarUrl(sender);
        const avatarImg = document.createElement('img');
        avatarImg.src = avatarUrl;
        avatarImg.style.cssText = 'width: 24px; height: 24px; border-radius: 50%; object-fit: cover; flex-shrink: 0;';
        avatarImg.alt = sender;
        
        const senderSpan = document.createElement('div');
        senderSpan.className = 'sender';
        senderSpan.textContent = sender;
        
        senderContainer.appendChild(avatarImg);
        senderContainer.appendChild(senderSpan);
        messageDiv.appendChild(senderContainer);
    }
    
    const textSpan = document.createElement('div');
    textSpan.className = 'text';
    textSpan.textContent = text;
    
    messageDiv.appendChild(textSpan);
    socialChatMessages.appendChild(messageDiv);
    
    // Прокручиваем вниз
    socialChatMessages.scrollTop = socialChatMessages.scrollHeight;
}

function addTurnEvent(playerName, action) {
    const eventDiv = document.createElement('div');
    eventDiv.className = 'turn-event';
    
    eventDiv.innerHTML = `
        <div class="player">${playerName}</div>
        <div class="action">${action}</div>
    `;
    
    turnHistory.appendChild(eventDiv);
    
    // Прокручиваем вниз
    turnHistory.scrollTop = turnHistory.scrollHeight;
}

function getRoleText(role) {
    switch(role) {
        case 'spy': return 'Шпион';
        case 'civilian': return 'Мирный житель';
        default: return 'Неизвестно';
    }
}

function startTimer(duration) {
    // Очищаем предыдущий таймер
    if (turnTimer) clearInterval(turnTimer);
    
    let timeLeft = duration;
    updateTimerDisplay(timeLeft);
    
    turnTimer = setInterval(() => {
        timeLeft--;
        updateTimerDisplay(timeLeft);
        
        if (timeLeft <= 0) {
            clearInterval(turnTimer);
            // Время вышло
            socket.emit('time_up', {
                roomCode: roomCode,
                timerType: currentTimerType
            });
            
            // Закрываем все модальные окна при окончании времени
            closeAllModals();
        }
    }, 1000);
}

function updateTimerDisplay(timeLeft) {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    // Меняем цвет при малом времени
    if (timeLeft <= 10) {
        timerEl.style.color = '#ff4757';
        timerEl.style.animation = 'pulse 1s infinite';
    } else if (timeLeft <= 30) {
        timerEl.style.color = '#ffa502';
    } else {
        timerEl.style.color = '#4db8ff';
        timerEl.style.animation = 'none';
    }
}

// Функция открытия модального окна просмотра картинки локации
function openLocationImageViewer(imageSrc) {
    if (locationImageViewerModal && locationImageViewerImage) {
        locationImageViewerImage.src = imageSrc;
        locationImageViewerModal.classList.add('active');
        playSound('button');
    }
}

// Функция добавления обработчика клика к картинке локации
function makeLocationImageClickable(imgElement) {
    if (imgElement) {
        imgElement.style.cursor = 'pointer';
        imgElement.addEventListener('click', function(e) {
            e.stopPropagation();
            openLocationImageViewer(this.src);
        });
    }
}

// Функция создания напоминания о локации
function createLocationReminder() {
    // Удаляем старое напоминание если есть
    if (locationReminder) {
        locationReminder.remove();
        locationReminder = null;
    }
    
    // Создаем напоминание только для не-шпиона
    if (playerRole !== 'spy' && currentLocation) {
        locationReminder = document.createElement('div');
        locationReminder.className = `location-reminder ${playerRole === 'spy' ? 'spy' : ''}`;
        (async () => {
            const avatarUrl = await getLocationAvatarUrl(currentLocation);
            locationReminder.innerHTML = `
                <i class="fas fa-map-marker-alt"></i>
                <img src="${avatarUrl}" alt="" style="width: 20px; height: 20px; border-radius: 4px; object-fit: cover; vertical-align: middle; margin: 0 6px;" onerror="this.style.display='none'">
                <span>Локация: ${escapeHtmlForDisplay(currentLocation)}</span>
            `;
            // Make the location image clickable
            const img = locationReminder.querySelector('img');
            makeLocationImageClickable(img);
        })();
        
        // Добавляем на страницу
        document.body.appendChild(locationReminder);
        
        // Показываем/скрываем при клике
        locationReminder.addEventListener('click', function(e) {
            if (e.target.tagName === 'IMG') return; // Don't minimize when clicking the image
            this.classList.toggle('minimized');
            if (this.classList.contains('minimized')) {
                this.innerHTML = '<i class="fas fa-map-marker-alt"></i>';
                this.style.padding = '10px';
            } else {
                (async () => {
                    const avatarUrl = await getLocationAvatarUrl(currentLocation);
                    this.innerHTML = `
                        <i class="fas fa-map-marker-alt"></i>
                        <img src="${avatarUrl}" alt="" style="width: 20px; height: 20px; border-radius: 4px; object-fit: cover; vertical-align: middle; margin: 0 6px;" onerror="this.style.display='none'">
                        <span>Локация: ${escapeHtmlForDisplay(currentLocation)}</span>
                    `;
                    // Make the location image clickable
                    const img = this.querySelector('img');
                    makeLocationImageClickable(img);
                })();
                this.style.padding = '10px 15px';
            }
        });
    }
}

function showFinalResults(data) {
    const isWinner = (data.winner === 'spies' && playerRole === 'spy') || 
                     (data.winner === 'civilians' && playerRole === 'civilian');
    
    // Устанавливаем флаг, что модальное окно открыто
    isModalOpen = true;
    
    // Создаем стиль для центрального отображения
    const modalContent = finalResultsModal.querySelector('.modal-content');
    modalContent.style.textAlign = 'center';
    modalContent.style.maxWidth = '500px';
    modalContent.style.margin = '50px auto';
    modalContent.style.display = 'flex';
    modalContent.style.flexDirection = 'column';
    modalContent.style.alignItems = 'center';
    modalContent.style.justifyContent = 'center';
    modalContent.style.padding = '40px 30px';
    
    if (isWinner) {
        finalResultsTitle.textContent = 'ПОБЕДА!';
        finalResultsTitle.style.color = '#4cd964';
        finalResultsTitle.style.textAlign = 'center';
        finalResultsTitle.style.width = '100%';
        finalResultsTitle.style.fontSize = '3.5rem';
        finalResultsTitle.style.margin = '0 0 20px 0';
        finalResultsTitle.style.fontWeight = '800';
        finalResultsTitle.style.letterSpacing = '2px';
        finalResultsIcon.innerHTML = '<i class="fas fa-trophy"></i>';
        finalResultsIcon.style.color = '#ffd700';
        finalResultsIcon.style.fontSize = '5rem';
        finalResultsIcon.style.margin = '0 0 30px 0';
        finalResultsIcon.style.display = 'block';
        playSound('win');
    } else {
        finalResultsTitle.textContent = 'ПОРАЖЕНИЕ';
        finalResultsTitle.style.color = '#ff6b6b';
        finalResultsTitle.style.textAlign = 'center';
        finalResultsTitle.style.width = '100%';
        finalResultsTitle.style.fontSize = '3.5rem';
        finalResultsTitle.style.margin = '0 0 20px 0';
        finalResultsTitle.style.fontWeight = '800';
        finalResultsTitle.style.letterSpacing = '2px';
        finalResultsIcon.innerHTML = '<i class="fas fa-times-circle"></i>';
        finalResultsIcon.style.color = '#ff6b6b';
        finalResultsIcon.style.fontSize = '5rem';
        finalResultsIcon.style.margin = '0 0 30px 0';
        finalResultsIcon.style.display = 'block';
        playSound('lose');
    }
    
    let html = `
        <div class="final-results-content" style="width: 100%; text-align: center;">
            <div class="result-item ${isWinner ? 'success' : 'failure'}" style="text-align: center; margin-bottom: 25px; display: flex; flex-direction: column; align-items: center;">
                <i class="fas ${isWinner ? 'fa-trophy' : 'fa-times'}" style="font-size: 2.5rem; margin-bottom: 10px;"></i>
                <span style="font-size: 1.8rem; font-weight: bold;">${isWinner ? 'Вы победили!' : 'Вы проиграли.'}</span>
            </div>
            <div class="result-item" style="text-align: center; margin-bottom: 15px; display: flex; justify-content: center; align-items: center;">
                <i class="fas fa-users" style="margin-right: 10px;"></i>
                <span>Победитель: <strong style="font-size: 1.2rem;">${data.winner === 'spies' ? 'Шпионы' : 'Мирные жители'}</strong></span>
            </div>
            <div class="result-item" style="text-align: center; margin-bottom: 15px; display: flex; justify-content: center; align-items: center;">
                <i class="fas fa-map-marker-alt" style="margin-right: 10px;"></i>
                <span>Локация: <img id="finalLocationAvatar" src="" alt="" style="width: 24px; height: 24px; border-radius: 4px; object-fit: cover; vertical-align: middle; margin: 0 6px; display: none;" onerror="this.style.display='none'"> <strong style="font-size: 1.2rem;">${data.location}</strong></span>
            </div>
            <div class="result-item" style="text-align: center; margin-bottom: 30px; display: flex; justify-content: center; align-items: center;">
                <i class="fas fa-user-secret" style="margin-right: 10px;"></i>
                <span>Шпион: <strong style="font-size: 1.2rem;">${data.spyName}</strong></span>
            </div>
        </div>
    `;
    
    finalResultsBody.innerHTML = html;
    finalResultsBody.style.width = '100%';
    finalResultsBody.style.textAlign = 'center';
    
    // Загружаем аватарку локации
    (async () => {
        const avatarUrl = await getLocationAvatarUrl(data.location);
        const avatarEl = document.getElementById('finalLocationAvatar');
        if (avatarEl) {
            avatarEl.src = avatarUrl;
            avatarEl.style.display = 'inline-block';
            // Make the location image clickable
            makeLocationImageClickable(avatarEl);
        }
    })();
    
    finalResultsModal.classList.add('active');
}

function updateConnectionStatus(connected) {
    // Если модальное окно открыто, не обновляем статус подключения
    if (isModalOpen) return;
    
    // Проверяем, что элемент существует
    if (!connectionStatus) return;
    
    const icon = connectionStatus.querySelector('i');
    const text = connectionStatus.querySelector('span');
    
    // Проверяем, что элементы найдены
    if (!icon || !text) return;
    
    if (connected) {
        icon.className = 'fas fa-wifi';
        connectionStatus.style.color = '#4cd964';
        text.textContent = 'Подключено к серверу';
    } else {
        icon.className = 'fas fa-wifi-slash';
        connectionStatus.style.color = '#ff6b6b';
        text.textContent = 'Нет подключения к серверу';
    }
}

function showError(message) {
    errorContainer.textContent = message;
    errorContainer.classList.add('active');
    
    // Автоматическое скрытие через 5 секунд
    setTimeout(() => {
        clearError();
    }, 5000);
}

function clearError() {
    errorContainer.classList.remove('active');
}

function showLobbyError(message) {
    lobbyErrorContainer.textContent = message;
    lobbyErrorContainer.classList.add('active');
}

function clearLobbyError() {
    lobbyErrorContainer.classList.remove('active');
}

function showCopyNotification(message) {
    // Создаем уведомление, если его нет
    let notification = document.querySelector('.copy-notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.className = 'copy-notification';
        document.body.appendChild(notification);
    }
    
    notification.textContent = message;
    notification.classList.add('active');
    
    setTimeout(() => {
        notification.classList.remove('active');
    }, 2000);
}

function playSound(type) {
    try {
        let sound;
        switch(type) {
            case 'button':
                sound = buttonSound;
                sound.volume = 0.3;
                break;
            case 'win':
                sound = winSound;
                sound.volume = 0.5;
                break;
            case 'lose':
                sound = loseSound;
                sound.volume = 0.5;
                break;
        }
        
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(e => console.log('Не удалось воспроизвести звук:', e));
        }
    } catch (e) {
        console.log('Ошибка воспроизведения звука:', e);
    }
}

// Переменная для отслеживания состояния эмодзи
let emojiEnabled = localStorage.getItem('spyEmojiEnabled') !== 'false';

// Функция создания падающих эмодзи шпиона - для обоих тем
function createSpyEmojiRain() {
    const rainContainer = document.querySelector('.emoji-rain');
    if (!rainContainer) return;
    
    // Очищаем контейнер
    rainContainer.innerHTML = '';
    
    // Если эмодзи отключены, не создаем их
    if (!emojiEnabled) {
        rainContainer.style.display = 'none';
        return;
    }
    
    rainContainer.style.display = 'block';
    
    // Создаем 70 падающих эмодзи
    const emojis = ['🕵️', '🕵️‍♂️', '🕵️‍♀️', '🔍', '🗺️', '🎯', '🎭'];
    
    for (let i = 0; i < 70; i++) {
        const emoji = document.createElement('div');
        emoji.className = 'falling-emoji';
        emoji.innerHTML = emojis[Math.floor(Math.random() * emojis.length)];
        emoji.style.left = Math.random() * 100 + '%';
        emoji.style.animationDuration = Math.random() * 15 + 15 + 's';
        emoji.style.animationDelay = Math.random() * -30 + 's';
        emoji.style.fontSize = Math.random() * 20 + 20 + 'px';
        
        const opacity = Math.random() * 0.08 + 0.12;
        emoji.style.opacity = opacity;
        
        rainContainer.appendChild(emoji);
    }
}

// Функция переключения падающих эмодзи
function toggleEmoji() {
    emojiEnabled = !emojiEnabled;
    localStorage.setItem('spyEmojiEnabled', emojiEnabled);
    
    const emojiToggleBtn = document.getElementById('emojiToggleBtn');
    const icon = emojiToggleBtn.querySelector('i');
    const rainContainer = document.querySelector('.emoji-rain');
    
    if (emojiEnabled) {
        icon.className = 'fas fa-cloud-moon';
        emojiToggleBtn.classList.remove('emoji-off');
        if (rainContainer) {
            rainContainer.style.display = 'block';
            createSpyEmojiRain();
        }
    } else {
        icon.className = 'fas fa-cloud-moon';
        emojiToggleBtn.classList.add('emoji-off');
        if (rainContainer) {
            rainContainer.style.display = 'none';
            rainContainer.innerHTML = '';
        }
    }
}

// Переменная для отслеживания состояния звука
let soundEnabled = localStorage.getItem('spySoundEnabled') !== 'false';

// Функция переключения звука
function toggleSound() {
    soundEnabled = !soundEnabled;
    localStorage.setItem('spySoundEnabled', soundEnabled);
    
    const soundToggleBtn = document.getElementById('soundToggleBtn');
    const icon = soundToggleBtn.querySelector('i');
    
    if (soundEnabled) {
        icon.className = 'fas fa-volume-up';
        soundToggleBtn.classList.remove('sound-off');
    } else {
        icon.className = 'fas fa-volume-up';
        soundToggleBtn.classList.add('sound-off');
    }
}

// Переопределяем функцию playSound
const originalPlaySound = playSound;
playSound = function(type) {
    if (!soundEnabled) return;
    if (typeof originalPlaySound === 'function') {
        originalPlaySound(type);
    }
};

// Обновляем функцию переключения темы
const originalToggleTheme = window.toggleTheme || function() {};
window.toggleTheme = function() {
    if (typeof originalToggleTheme === 'function') {
        originalToggleTheme();
    }
    
    setTimeout(() => {
        if (emojiEnabled) {
            createSpyEmojiRain();
        }
    }, 50);
};

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Создаем падающие эмодзи
    if (emojiEnabled) {
        createSpyEmojiRain();
    } else {
        const rainContainer = document.querySelector('.emoji-rain');
        if (rainContainer) {
            rainContainer.style.display = 'none';
        }
    }
    
    // Настраиваем кнопку звука
    const soundToggleBtn = document.getElementById('soundToggleBtn');
    if (soundToggleBtn) {
        const icon = soundToggleBtn.querySelector('i');
        if (soundEnabled) {
            icon.className = 'fas fa-volume-up';
            soundToggleBtn.classList.remove('sound-off');
        } else {
            icon.className = 'fas fa-volume-up';
            soundToggleBtn.classList.add('sound-off');
        }
        
        soundToggleBtn.addEventListener('click', toggleSound);
    }
    
    // Настраиваем кнопку отключения эмодзи
    const emojiToggleBtn = document.getElementById('emojiToggleBtn');
    if (emojiToggleBtn) {
        const icon = emojiToggleBtn.querySelector('i');
        if (emojiEnabled) {
            icon.className = 'fas fa-cloud-moon';
            emojiToggleBtn.classList.remove('emoji-off');
        } else {
            icon.className = 'fas fa-cloud-moon';
            emojiToggleBtn.classList.add('emoji-off');
        }
        
        emojiToggleBtn.addEventListener('click', toggleEmoji);
    }
});

// Периодически обновляем эмодзи
setInterval(() => {
    if (!emojiEnabled) return;
    
    const rainContainer = document.querySelector('.emoji-rain');
    if (rainContainer && rainContainer.children.length < 60) {
        const emojis = ['🕵️', '🕵️‍♂️', '🕵️‍♀️', '🔍', '🗺️', '🎯', '🎭'];
        for (let i = 0; i < 10; i++) {
            if (rainContainer.children.length >= 80) break;
            
            const emoji = document.createElement('div');
            emoji.className = 'falling-emoji';
            emoji.innerHTML = emojis[Math.floor(Math.random() * emojis.length)];
            emoji.style.left = Math.random() * 100 + '%';
            emoji.style.animationDuration = Math.random() * 15 + 15 + 's';
            emoji.style.animationDelay = '0s';
            emoji.style.fontSize = Math.random() * 20 + 20 + 'px';
            emoji.style.opacity = Math.random() * 0.08 + 0.12;
            rainContainer.appendChild(emoji);
        }
    }
}, 5000);

// Экспортируем функции для использования в HTML
window.kickPlayer = kickPlayer;