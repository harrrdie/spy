const profileId = parseInt(window.location.pathname.split('/profile/')[1]) || null;
let boundOtherActionsForUser = null;

function getAvatarUrl(seed) {
    if (!seed) return 'https://api.dicebear.com/7.x/avataaars/svg?seed=default&backgroundColor=4db8ff';
    // Если это URL (начинается с /uploads/), возвращаем его
    if (seed.startsWith('/uploads/')) return seed;
    // Иначе используем dicebear
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}&backgroundColor=4db8ff`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function loadProfile() {
    const id = profileId || (await fetch('/api/auth/me', { credentials: 'same-origin' }).then(r => r.json()).then(d => d.user?.id));
    if (!id) {
        document.getElementById('profileLoading').style.display = 'none';
        document.getElementById('profileNotFound').style.display = 'block';
        document.getElementById('profileNotFound').innerHTML = '<h2>Войдите в аккаунт</h2><p>Чтобы просмотреть профиль, необходимо авторизоваться.</p><a href="/login" class="btn-primary" style="display: inline-block; width: auto; margin-top: 15px;">Войти</a>';
        return;
    }

    try {
        const res = await fetch(`/api/profile/${id}`);
        const data = await res.json();

        if (res.status === 404 || data.error) {
            document.getElementById('profileLoading').style.display = 'none';
            document.getElementById('profileNotFound').style.display = 'block';
            return;
        }

        const { user, stats, comments, likeCount, isLiked, friends, achievements, isFriend, friendRequestSent, friendRequestPending } = data;
        const currentUser = await fetch('/api/auth/me', { credentials: 'same-origin' }).then(r => r.json()).then(d => d.user);
        const isOwnProfile = currentUser && currentUser.id === user.id;

        document.getElementById('profileAvatar').src = getAvatarUrl(user.avatar_seed);
        document.getElementById('profileDisplayName').textContent = user.display_name || user.username;
        document.getElementById('profileUsername').textContent = '@' + user.username;

        document.getElementById('statGamesPlayed').textContent = stats.games_played || 0;
        document.getElementById('statWonSpy').textContent = stats.games_won_as_spy || 0;
        document.getElementById('statWonCivilian').textContent = stats.games_won_as_civilian || 0;
        document.getElementById('statLost').textContent = stats.games_lost || 0;
        const statRating = document.getElementById('statRating');
        if (statRating) statRating.textContent = stats.rating ?? 0;

        // Лайки
        const likeBtn = document.getElementById('likeProfileBtn');
        const likeCountEl = document.getElementById('likeCount');
        const likeBtnText = document.getElementById('likeBtnText');
        if (likeCountEl) likeCountEl.textContent = likeCount || 0;
        if (likeBtn) {
            likeBtn.className = 'profile-like-btn' + (isLiked ? ' liked' : '');
            likeBtn.innerHTML = `<i class="fas fa-heart"></i> <span id="likeBtnText">${isLiked ? 'Не нравится' : 'Нравится'}</span> <span class="profile-like-count" id="likeCount">${likeCount || 0}</span>`;
        }

        // Друзья
        const friendsList = document.getElementById('friendsList');
        friendsList.innerHTML = '';
        if (friends && friends.length > 0) {
            friends.forEach(f => {
                const card = document.createElement('a');
                card.href = '/profile/' + f.id;
                card.className = 'friend-card';
                card.style.textDecoration = 'none';
                card.style.color = 'inherit';
                card.innerHTML = `
                    <img class="friend-avatar" src="${getAvatarUrl(f.avatar_seed)}" alt="">
                    <span>${escapeHtml(f.display_name || f.username)}</span>
                `;
                friendsList.appendChild(card);
            });
        } else {
            friendsList.innerHTML = '<p style="color: #888;">Нет друзей</p>';
        }

        // Достижения
        const achievementsList = document.getElementById('achievementsList');
        achievementsList.innerHTML = '';
        if (achievements && achievements.length > 0) {
            achievements.forEach(a => {
                const badge = document.createElement('div');
                badge.className = 'achievement-badge';
                badge.title = a.description || a.name;
                badge.innerHTML = `<i class="fas ${a.icon || 'fa-trophy'}"></i><div><strong>${escapeHtml(a.name)}</strong><br><small style="color:#888">${new Date(a.unlocked_at).toLocaleDateString('ru')}</small></div>`;
                achievementsList.appendChild(badge);
            });
        } else {
            achievementsList.innerHTML = '<p style="color: #888;">Пока нет достижений</p>';
        }

        // Комментарии
        const commentsList = document.getElementById('commentsList');
        commentsList.innerHTML = '';
        if (comments && comments.length > 0) {
            comments.forEach(c => {
                const div = document.createElement('div');
                div.className = 'comment';
                div.dataset.commentId = c.id;
                const canDelete = currentUser && (c.author_id === currentUser.id || user.id === currentUser.id);
                const canEdit = currentUser && c.author_id === currentUser.id;
                let actions = '';
                if (canEdit) actions += '<button type="button" class="comment-edit-btn" style="margin-right:8px;"><i class="fas fa-pen"></i> Редактировать</button>';
                if (canDelete) actions += '<button type="button" class="comment-delete-btn"><i class="fas fa-trash"></i> Удалить</button>';
                div.innerHTML = `
                    <div class="comment-author"><a href="/profile/${c.author_id}">${escapeHtml(c.author_name)}</a></div>
                    <div class="comment-text">${escapeHtml(c.text)}</div>
                    <div class="comment-date">${new Date(c.created_at).toLocaleString('ru')}</div>
                    ${actions ? '<div class="comment-actions" style="margin-top:8px;">' + actions + '</div>' : ''}
                    ${canEdit ? `
                        <div class="comment-edit-area" style="display:none;">
                            <textarea class="comment-edit-input">${escapeHtml(c.text)}</textarea>
                            <div class="comment-edit-actions">
                                <button type="button" class="comment-save-btn btn-primary" style="width: auto; padding: 8px 14px; font-size: 0.85rem;"><i class="fas fa-check"></i> Сохранить</button>
                                <button type="button" class="comment-cancel-btn btn-secondary" style="width: auto; padding: 8px 14px; font-size: 0.85rem;"><i class="fas fa-times"></i> Отмена</button>
                            </div>
                        </div>
                    ` : ''}
                `;
                if (canDelete) {
                    div.querySelector('.comment-delete-btn').addEventListener('click', async () => {
                        if (!confirm('Удалить комментарий?')) return;
                        try {
                            const r = await fetch(`/api/profile/${user.id}/comments/${c.id}`, { method: 'DELETE', credentials: 'same-origin' });
                            const d = await r.json();
                            if (d.success) {
                                // Удаляем элемент из DOM сразу
                                div.remove();
                                // Перезагружаем профиль для синхронизации
                                setTimeout(() => loadProfile(), 100);
                            } else {
                                alert(d.error || 'Ошибка');
                            }
                        } catch (e) { alert('Ошибка'); }
                    });
                }
                if (canEdit) {
                    const editBtn = div.querySelector('.comment-edit-btn');
                    const editArea = div.querySelector('.comment-edit-area');
                    const textEl = div.querySelector('.comment-text');
                    const textarea = editArea?.querySelector('.comment-edit-input');
                    const saveBtn = editArea?.querySelector('.comment-save-btn');
                    const cancelBtn = editArea?.querySelector('.comment-cancel-btn');

                    if (editBtn && editArea && textEl && textarea && saveBtn && cancelBtn) {
                        editBtn.addEventListener('click', () => {
                            textarea.value = c.text;
                            editArea.style.display = 'block';
                            textEl.style.display = 'none';
                        });

                        cancelBtn.onclick = () => {
                            editArea.style.display = 'none';
                            textEl.style.display = '';
                        };

                        saveBtn.onclick = async () => {
                            const newText = textarea.value.trim();
                            if (!newText || newText === c.text) {
                                editArea.style.display = 'none';
                                textEl.style.display = '';
                                return;
                            }
                            try {
                                const r = await fetch(`/api/profile/${user.id}/comments/${c.id}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ text: newText }),
                                    credentials: 'same-origin'
                                });
                                const d = await r.json();
                                if (d.success) {
                                    c.text = newText;
                                    textEl.textContent = newText;
                                    editArea.style.display = 'none';
                                    textEl.style.display = '';
                                } else {
                                    alert(d.error || 'Ошибка');
                                }
                            } catch {
                                alert('Ошибка');
                            }
                        };
                    }
                }
                commentsList.appendChild(div);
            });
        } else {
            commentsList.innerHTML = '<p style="color: #888;">Пока нет комментариев.</p>';
        }

        if (currentUser && !isOwnProfile) {
            document.getElementById('commentForm').style.display = 'block';
            document.getElementById('profileActionsOther').style.display = 'flex';
            document.getElementById('profileActionsOther').style.flexWrap = 'wrap';
            document.getElementById('profileActionsOther').style.gap = '10px';
        }
        if (isOwnProfile) {
            document.getElementById('profileActions').style.display = 'flex';
        }

        document.getElementById('profileLoading').style.display = 'none';
        document.getElementById('profileContent').style.display = 'block';

        setupEventListeners(user, isOwnProfile, { likeCount: likeCount || 0, isLiked, isFriend, friendRequestSent, friendRequestPending });
    } catch (err) {
        console.error(err);
        document.getElementById('profileLoading').style.display = 'none';
        document.getElementById('profileNotFound').style.display = 'block';
    }
}

let currentProfileUserId = null;
function setupEventListeners(user, isOwnProfile, state) {
    document.getElementById('commentInput')?.addEventListener('input', () => {
        const el = document.getElementById('commentCount');
        if (el) el.textContent = document.getElementById('commentInput').value.length;
    });

    const submitBtn = document.getElementById('submitCommentBtn');
    if (submitBtn) {
        // Удаляем старый обработчик если есть
        const newBtn = submitBtn.cloneNode(true);
        submitBtn.parentNode.replaceChild(newBtn, submitBtn);
        newBtn.addEventListener('click', async () => {
            const text = document.getElementById('commentInput').value.trim();
            if (!text) return;
            try {
                const res = await fetch(`/api/profile/${user.id}/comments`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text }),
                    credentials: 'same-origin'
                });
                const data = await res.json();
                if (data.success) {
                    document.getElementById('commentInput').value = '';
                    document.getElementById('commentCount').textContent = '0';
                    loadProfile();
                } else {
                    alert(data.error || 'Ошибка');
                }
            } catch (err) {
                alert('Ошибка отправки комментария');
            }
        });
    }

    if (document.getElementById('likeProfileBtn') && boundOtherActionsForUser !== user.id) {
        boundOtherActionsForUser = user.id;
    document.getElementById('likeProfileBtn').addEventListener('click', async () => {
        try {
            const res = await fetch(`/api/profile/${user.id}/like`, { method: 'POST', credentials: 'same-origin' });
            const data = await res.json();
            if (data.success) {
                const btn = document.getElementById('likeProfileBtn');
                const countEl = document.getElementById('likeCount');
                btn.className = 'profile-like-btn' + (data.isLiked ? ' liked' : '');
                btn.querySelector('#likeBtnText').textContent = data.isLiked ? 'Не нравится' : 'Нравится';
                if (countEl) countEl.textContent = data.likeCount;
            }
        } catch (e) { alert('Ошибка'); }
    });

    // Открыть модальное окно лайков при клике на количество
    const likeCountEl = document.getElementById('likeCount');
    if (likeCountEl) {
        likeCountEl.addEventListener('click', async (e) => {
            e.stopPropagation();
            const likesModal = document.getElementById('likesModal');
            const likesLoading = document.getElementById('likesLoading');
            const likesList = document.getElementById('likesList');
            
            if (!likesModal) return;
            
            likesModal.classList.add('active');
            likesLoading.style.display = 'block';
            likesList.innerHTML = '';
            
            try {
                const res = await fetch(`/api/profile/${user.id}/likes`);
                const data = await res.json();
                likesLoading.style.display = 'none';
                
                if (data.success && data.likers && data.likers.length > 0) {
                    likesList.innerHTML = '';
                    data.likers.forEach(liker => {
                        const a = document.createElement('a');
                        a.href = `/profile/${liker.id}`;
                        a.className = 'like-item';
                        a.innerHTML = `
                            <img src="${getAvatarUrl(liker.avatar_seed)}" alt="" class="like-item-avatar">
                            <div class="like-item-info">
                                <div class="like-item-name">${escapeHtml(liker.display_name)}</div>
                                <div class="like-item-username">@${escapeHtml(liker.username)}</div>
                            </div>
                        `;
                        likesList.appendChild(a);
                    });
                } else {
                    likesList.innerHTML = '<p style="color: #888; text-align: center; padding: 20px;">Никто еще не лайкнул профиль</p>';
                }
            } catch (e) {
                likesLoading.style.display = 'none';
                likesList.innerHTML = '<p style="color: #ff6b6b; text-align: center; padding: 20px;">Ошибка загрузки</p>';
            }
        });
    }

    // Закрыть модальное окно лайков
    const closeLikesBtn = document.getElementById('closeLikesBtn');
    const likesModal = document.getElementById('likesModal');
    if (closeLikesBtn) {
        closeLikesBtn.addEventListener('click', () => {
            if (likesModal) likesModal.classList.remove('active');
        });
    }
    if (likesModal) {
        likesModal.addEventListener('click', (e) => {
            if (e.target === likesModal) {
                likesModal.classList.remove('active');
            }
        });
    }

    const addFriendBtnEl = document.getElementById('addFriendBtn');
    if (addFriendBtnEl) {
        const sent = state.friendRequestSent;
        const pending = state.friendRequestPending;
        addFriendBtnEl.innerHTML = state.isFriend ? '<i class="fas fa-user-check"></i> В друзьях' : pending ? '<i class="fas fa-user-check"></i> Принять заявку' : sent ? '<i class="fas fa-clock"></i> Заявка отправлена' : '<i class="fas fa-user-plus"></i> В друзья';
        addFriendBtnEl.disabled = state.isFriend || sent;
    }
    document.getElementById('addFriendBtn')?.addEventListener('click', async () => {
        try {
            const res = await fetch(`/api/profile/${user.id}/friend`, { method: 'POST', credentials: 'same-origin' });
            const data = await res.json();
            if (data.success) {
                loadProfile();
            } else {
                alert(data.error || 'Ошибка');
            }
        } catch (e) { alert('Ошибка'); }
    });

    }

    if (isOwnProfile) {
        const avatarEl = document.getElementById('profileAvatar');
        const avatarFileInput = document.getElementById('avatarFileInput');
        if (avatarEl && avatarFileInput) {
            avatarEl.addEventListener('click', () => {
                // Показать модальное окно выбора способа
                const modal = document.createElement('div');
                modal.className = 'modal active';
                modal.innerHTML = `
                    <div class="modal-content">
                        <h2>Сменить аватар</h2>
                        <div style="display: flex; flex-direction: column; gap: 15px; margin: 20px 0;">
                            <button class="btn-primary" id="uploadAvatarBtn" style="width: 100%;">
                                <i class="fas fa-upload"></i> Загрузить свой файл
                            </button>
                            <button class="btn-secondary" id="chooseExistingBtn" style="width: 100%;">
                                <i class="fas fa-images"></i> Выбрать из существующих
                            </button>
                        </div>
                        <button class="btn-secondary" onclick="this.closest('.modal').remove()">Отмена</button>
                    </div>
                `;
                document.body.appendChild(modal);
                
                const uploadBtn = modal.querySelector('#uploadAvatarBtn');
                const chooseBtn = modal.querySelector('#chooseExistingBtn');
                
                uploadBtn.addEventListener('click', () => {
                    modal.remove();
                    avatarFileInput.click();
                });
                
                chooseBtn.addEventListener('click', () => {
                    modal.remove();
                    // Показать модальное окно выбора из существующих
                    const chooseModal = document.createElement('div');
                    chooseModal.className = 'modal active';
                    chooseModal.innerHTML = `
                        <div class="modal-content">
                            <h2>Выберите аватар</h2>
                            <div id="existingAvatarsList" style="display: flex; flex-wrap: wrap; gap: 10px; margin: 15px 0;"></div>
                            <button class="btn-secondary" onclick="this.closest('.modal').remove()">Отмена</button>
                        </div>
                    `;
                    document.body.appendChild(chooseModal);
                    const list = chooseModal.querySelector('#existingAvatarsList');
                    const seeds = ['default', user.username, 'avatar1', 'avatar2', 'avatar3', 'spy', 'agent', 'player'];
                    seeds.forEach(seed => {
                        const img = document.createElement('img');
                        img.src = getAvatarUrl(seed);
                        img.style.cssText = 'width:64px;height:64px;border-radius:50%;cursor:pointer;border:3px solid transparent;';
                        const currentSeed = user.avatar_seed || user.username;
                        if (currentSeed === seed || (currentSeed && currentSeed.startsWith('/uploads/') && seed === 'default')) {
                            img.style.borderColor = '#4db8ff';
                        }
                        img.addEventListener('click', async () => {
                            try {
                                const r = await fetch('/api/profile/avatar', {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ avatar_seed: seed }),
                                    credentials: 'same-origin'
                                });
                                const d = await r.json();
                                if (d.success) {
                                    chooseModal.remove();
                                    loadProfile();
                                }
                            } catch (e) {}
                        });
                        list.appendChild(img);
                    });
                });
            });
            avatarFileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const formData = new FormData();
                formData.append('avatar', file);
                try {
                    const r = await fetch('/api/profile/avatar/upload', {
                        method: 'POST',
                        body: formData,
                        credentials: 'same-origin'
                    });
                    const d = await r.json();
                    if (d.success) {
                        loadProfile();
                    } else {
                        alert(d.error || 'Ошибка');
                    }
                } catch (e) {
                    alert('Ошибка загрузки');
                }
                avatarFileInput.value = '';
            });
        }
        document.getElementById('editProfileBtn')?.addEventListener('click', () => {
            document.getElementById('editDisplayName').value = user.display_name || user.username;
            const cur = document.getElementById('editCurrentPassword');
            const np = document.getElementById('editNewPassword');
            const npc = document.getElementById('editNewPasswordConfirm');
            const errEl = document.getElementById('editPasswordError');
            if (cur) cur.value = '';
            if (np) np.value = '';
            if (npc) npc.value = '';
            if (errEl) {
                errEl.textContent = '';
                errEl.style.display = 'none';
            }
            document.getElementById('editModal').classList.add('active');
        });

        document.getElementById('saveProfileBtn')?.addEventListener('click', async () => {
            const displayName = document.getElementById('editDisplayName').value.trim();
            const cur = document.getElementById('editCurrentPassword');
            const np = document.getElementById('editNewPassword');
            const npc = document.getElementById('editNewPasswordConfirm');
            const errEl = document.getElementById('editPasswordError');
            const current = cur ? cur.value : '';
            const newP = np ? np.value : '';
            const confirmP = npc ? npc.value : '';
            if (errEl) {
                errEl.textContent = '';
                errEl.style.display = 'none';
            }

            try {
                // Обновление отображаемого имени (если изменилось)
                if (displayName && displayName !== (user.display_name || user.username)) {
                    const nameRes = await fetch('/api/profile/display-name', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ display_name: displayName }),
                        credentials: 'same-origin'
                    });
                    const nameData = await nameRes.json();
                    if (!nameData.success && nameRes.status !== 200) {
                        alert(nameData.error || 'Ошибка имени');
                        return;
                    }
                }

                // Смена пароля, если что-то введено
                const wantChangePassword = current || newP || confirmP;
                if (wantChangePassword) {
                    if (!current || !newP || !confirmP) {
                        if (errEl) {
                            errEl.textContent = 'Заполните все поля для смены пароля';
                            errEl.style.display = 'block';
                        }
                        return;
                    }
                    if (newP.length < 6) {
                        if (errEl) {
                            errEl.textContent = 'Новый пароль не менее 6 символов';
                            errEl.style.display = 'block';
                        }
                        return;
                    }
                    if (newP !== confirmP) {
                        if (errEl) {
                            errEl.textContent = 'Пароли не совпадают';
                            errEl.style.display = 'block';
                        }
                        return;
                    }
                    const res = await fetch('/api/auth/password', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ currentPassword: current, newPassword: newP }),
                        credentials: 'same-origin'
                    });
                    const data = await res.json();
                    if (!data.success) {
                        if (errEl) {
                            errEl.textContent = data.error || 'Ошибка смены пароля';
                            errEl.style.display = 'block';
                        } else {
                            alert(data.error || 'Ошибка смены пароля');
                        }
                        return;
                    }
                }

                document.getElementById('editModal').classList.remove('active');
                if (cur) cur.value = '';
                if (np) np.value = '';
                if (npc) npc.value = '';
                loadProfile();
            } catch (err) {
                if (errEl) {
                    errEl.textContent = 'Ошибка сохранения';
                    errEl.style.display = 'block';
                } else {
                    alert('Ошибка сохранения');
                }
            }
        });

        document.getElementById('closeEditBtn')?.addEventListener('click', () => {
            document.getElementById('editModal').classList.remove('active');
        });
    } else {
        const addFriendBtn = document.getElementById('addFriendBtn');
        if (addFriendBtn) {
            addFriendBtn.innerHTML = state.isFriend ? '<i class="fas fa-user-check"></i> В друзьях' : (state.friendRequestPending ? '<i class="fas fa-user-check"></i> Принять заявку' : (state.friendRequestSent ? '<i class="fas fa-clock"></i> Заявка отправлена' : '<i class="fas fa-user-plus"></i> В друзья'));
            addFriendBtn.disabled = state.isFriend || state.friendRequestSent;
        }
    }
}

async function updateHeaderAuth() {
    const el = document.getElementById('headerAuth');
    if (!el) return;
    try {
        const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
        const data = await res.json();
        if (data.user) {
            el.innerHTML = `
                <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
                    <a href="/profile/${data.user.id}" style="color: #4db8ff; text-decoration: none;">
                        <i class="fas fa-user"></i> ${escapeHtml(data.user.display_name || data.user.username)}
                    </a>
                    <a href="/leaderboard" style="color: #4db8ff; text-decoration: none;">
                        <i class="fas fa-trophy"></i> Рейтинг
                    </a>
                    <a href="#" id="logoutBtn" style="color: #ff6b6b; text-decoration: none;">
                        <i class="fas fa-sign-out-alt"></i> Выйти
                    </a>
                </div>
            `;
            document.getElementById('logoutBtn')?.addEventListener('click', async (e) => {
                e.preventDefault();
                await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
                window.location.reload();
            });
        } else {
            el.innerHTML = `
                <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
                    <a href="/login" style="color: #4db8ff; text-decoration: none;">
                        <i class="fas fa-sign-in-alt"></i> Войти
                    </a>
                    <a href="/leaderboard" style="color: #4db8ff; text-decoration: none;">
                        <i class="fas fa-trophy"></i> Рейтинг
                    </a>
                </div>
            `;
        }
    } catch {
        el.innerHTML = `
            <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
                <a href="/login" style="color: #4db8ff; text-decoration: none;">
                    Войти
                </a>
            </div>
        `;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('spyTheme');
    if (savedTheme === 'light') {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
    }
    updateHeaderAuth();
    loadProfile();
    // Поиск в шапке
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
                            a.style.cssText = 'display: flex; align-items: center; gap: 12px; padding: 10px 12px; color: inherit; text-decoration: none; border-bottom: 1px solid rgba(255,255,255,0.06);';
                            a.innerHTML = '<img src="' + getAvatarUrl(u.avatar_seed || u.username) + '" style="width:36px;height:36px;border-radius:50%;object-fit:cover;"><div><strong>' + escapeHtml(u.display_name || u.username) + '</strong><br><small style="color:#888">@' + escapeHtml(u.username) + '</small></div>';
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
        document.addEventListener('click', (e) => {
            if (!headerSearch.contains(e.target) && !headerSearchResults.contains(e.target))
                headerSearchResults.style.display = 'none';
        });
    }
});
