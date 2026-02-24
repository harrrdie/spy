document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('spyTheme');
    if (savedTheme === 'light') {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) themeToggle.checked = true;
    }

    initAdminHeaderAuth();
    initTabs();
    loadAdminSummary();
    initUsersTab();
    initCommentsTab();
    initLocationsTab();

    const saveStatsBtn = document.getElementById('adminStatsSaveBtn');
    const cancelStatsBtn = document.getElementById('adminStatsCancelBtn');
    if (saveStatsBtn) saveStatsBtn.addEventListener('click', onSaveStats);
    if (cancelStatsBtn) cancelStatsBtn.addEventListener('click', closeStatsModal);
});

async function initAdminHeaderAuth() {
    const el = document.getElementById('adminHeaderAuth');
    const accessError = document.getElementById('adminAccessError');
    const adminContent = document.getElementById('adminContent');
    if (!el) return;
    try {
        const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
        const data = await res.json();
        const user = data.user;
        if (!user) {
            el.innerHTML = `
                <a href="/login" style="color:#4db8ff;text-decoration:none;">
                    <i class="fas fa-sign-in-alt"></i> Войти
                </a>
            `;
            if (accessError) {
                accessError.textContent = 'Доступ только для администраторов. Войдите под пользователем admin.';
                accessError.style.display = 'block';
                accessError.classList.add('active');
            }
            return;
        }
        const isAdmin = !!user.is_admin;
        el.innerHTML = `
            <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
                <a href="/profile/${user.id}" style="color:#4db8ff;text-decoration:none;">
                    <i class="fas fa-user-shield"></i> ${escapeHtml(user.display_name || user.username)}
                </a>
                <a href="/" style="color:#4db8ff;text-decoration:none;"><i class="fas fa-gamepad"></i> Играть</a>
                <a href="#" id="adminLogoutBtn" style="color:#ff6b6b;text-decoration:none;"><i class="fas fa-sign-out-alt"></i> Выйти</a>
            </div>
        `;
        document.getElementById('adminLogoutBtn')?.addEventListener('click', async (e) => {
            e.preventDefault();
            await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
            window.location.href = '/';
        });

        if (!isAdmin) {
            if (accessError) {
                accessError.textContent = 'У вашего аккаунта нет прав администратора.';
                accessError.style.display = 'block';
                accessError.classList.add('active');
            }
            return;
        }
        if (adminContent) {
            adminContent.style.display = 'block';
        }
    } catch {
        if (accessError) {
            accessError.textContent = 'Ошибка проверки прав доступа.';
            accessError.style.display = 'block';
            accessError.classList.add('active');
        }
    }
}

function initTabs() {
    const buttons = document.querySelectorAll('.admin-nav button[data-tab]');
    buttons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const tab = btn.getAttribute('data-tab');
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.admin-tab').forEach(sec => {
                sec.style.display = sec.id === 'tab-' + tab ? 'block' : 'none';
            });
        });
    });
}

async function loadAdminSummary() {
    try {
        const res = await fetch('/api/admin/summary', { credentials: 'same-origin' });
        if (!res.ok) return;
        const data = await res.json();
        const statsEl = document.getElementById('dashboardStats');
        const usersTable = document.getElementById('dashboardUsersTable');
        const logsTable = document.getElementById('logsTable');
        if (statsEl) {
            statsEl.innerHTML = '';
            const items = [
                { label: 'Пользователей', value: data.totals?.users ?? 0, icon: 'fa-users' },
                { label: 'Забанено', value: data.totals?.bannedUsers ?? 0, icon: 'fa-user-slash' },
                { label: 'Игр сыграно', value: data.totals?.games ?? 0, icon: 'fa-gamepad' },
                { label: 'Комментариев', value: data.totals?.comments ?? 0, icon: 'fa-comments' },
                { label: 'Пользовательских локаций', value: data.totals?.userLocations ?? 0, icon: 'fa-map-marked-alt' }
            ];
            items.forEach(item => {
                const div = document.createElement('div');
                div.className = 'admin-stat';
                div.innerHTML = `
                    <div class="label"><i class="fas ${item.icon}"></i> ${item.label}</div>
                    <div class="value">${item.value}</div>
                `;
                statsEl.appendChild(div);
            });
        }
        if (usersTable) {
            const rows = data.lastUsers || [];
            let html = '<thead><tr><th>ID</th><th>Пользователь</th><th>Роли</th><th>Создан</th></tr></thead><tbody>';
            rows.forEach(u => {
                const avatarUrl = getAvatarUrl(u.avatar_seed || u.username);
                html += `
                    <tr>
                        <td>${u.id}</td>
                        <td>
                            <div class="admin-user-cell">
                                <img src="${avatarUrl}" alt="" class="admin-user-avatar">
                                <div>
                                    <div><strong>${escapeHtml(u.display_name || u.username)}</strong></div>
                                    <div style="font-size:0.8rem;color:#aaa;">@${escapeHtml(u.username)}</div>
                                </div>
                            </div>
                        </td>
                        <td>
                            ${u.is_admin ? '<span class="badge badge-admin">admin</span>' : ''}
                            ${u.is_banned ? '<span class="badge badge-banned">ban</span>' : ''}
                        </td>
                        <td>${new Date(u.created_at).toLocaleString('ru')}</td>
                    </tr>
                `;
            });
            html += '</tbody>';
            usersTable.innerHTML = html;
        }
        if (logsTable) {
            const rows = data.lastAdminActions || [];
            let html = '<thead><tr><th>Когда</th><th>Админ</th><th>Цель</th><th>Действие</th><th>Детали</th></tr></thead><tbody>';
            rows.forEach(l => {
                let details = '';
                try {
                    if (l.details) {
                        const obj = JSON.parse(l.details);
                        details = JSON.stringify(obj);
                    }
                } catch {
                    details = l.details || '';
                }
                html += `
                    <tr>
                        <td>${new Date(l.created_at).toLocaleString('ru')}</td>
                        <td>${escapeHtml(l.admin_username || '')}</td>
                        <td>${escapeHtml(l.target_username || '')}</td>
                        <td>${escapeHtml(l.action)}</td>
                        <td style="max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(details)}">${escapeHtml(details)}</td>
                    </tr>
                `;
            });
            html += '</tbody>';
            logsTable.innerHTML = html;
        }
    } catch (e) {
        // игнорируем, на экране есть другие разделы
    }
}

function initUsersTab() {
    const reloadBtn = document.getElementById('usersReloadBtn');
    const searchInput = document.getElementById('usersSearch');
    const bannedOnly = document.getElementById('usersOnlyBanned');
    if (reloadBtn) reloadBtn.addEventListener('click', () => loadUsers());
    if (searchInput) {
        let t;
        searchInput.addEventListener('input', () => {
            clearTimeout(t);
            t = setTimeout(() => loadUsers(), 300);
        });
    }
    if (bannedOnly) bannedOnly.addEventListener('change', () => loadUsers());
    loadUsers();
}

async function loadUsers() {
    const table = document.getElementById('usersTable');
    const q = (document.getElementById('usersSearch')?.value || '').trim();
    const bannedOnly = document.getElementById('usersOnlyBanned')?.checked;
    if (!table) return;
    table.innerHTML = '<tbody><tr><td>Загрузка...</td></tr></tbody>';
    try {
        const params = new URLSearchParams();
        if (q.length >= 2) params.set('q', q);
        if (bannedOnly) params.set('banned', '1');
        const res = await fetch('/api/admin/users?' + params.toString(), { credentials: 'same-origin' });
        if (!res.ok) {
            table.innerHTML = '<tbody><tr><td>Ошибка загрузки</td></tr></tbody>';
            return;
        }
        const data = await res.json();
        const rows = data.users || [];
        let html = '<thead><tr><th>ID</th><th>Пользователь</th><th>Рейтинг</th><th>Роли</th><th>Действия</th></tr></thead><tbody>';
        rows.forEach(u => {
            const avatarUrl = getAvatarUrl(u.avatar_seed || u.username);
            html += `
                <tr data-user-id="${u.id}">
                    <td>${u.id}</td>
                    <td>
                        <div class="admin-user-cell">
                            <img src="${avatarUrl}" alt="" class="admin-user-avatar">
                            <div>
                                <div><strong>${escapeHtml(u.display_name || u.username)}</strong></div>
                                <div style="font-size:0.8rem;color:#aaa;">@${escapeHtml(u.username)}</div>
                            </div>
                        </div>
                    </td>
                    <td>${u.rating ?? 0}</td>
                    <td>
                        ${u.is_admin ? '<span class="badge badge-admin">admin</span>' : ''}
                        ${u.is_banned ? '<span class="badge badge-banned">ban</span>' : ''}
                    </td>
                    <td>
                        <button type="button" class="btn-secondary" style="width:auto;font-size:0.8rem;padding:4px 8px;" data-action="details">Подробнее</button>
                    </td>
                </tr>
            `;
        });
        html += '</tbody>';
        table.innerHTML = html;
        table.querySelectorAll('button[data-action="details"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const tr = btn.closest('tr');
                const id = tr?.getAttribute('data-user-id');
                if (id) loadUserDetails(parseInt(id, 10));
            });
        });
    } catch {
        table.innerHTML = '<tbody><tr><td>Ошибка загрузки</td></tr></tbody>';
    }
}

async function loadUserDetails(userId) {
    const container = document.getElementById('userDetailsCard');
    if (!container) return;
    container.style.display = 'block';
    container.innerHTML = '<p>Загрузка...</p>';
    try {
        const res = await fetch('/api/admin/users/' + userId, { credentials: 'same-origin' });
        if (!res.ok) {
            container.innerHTML = '<p>Ошибка загрузки пользователя</p>';
            return;
        }
        const { user, stats, commentsCount, gamesCount } = await res.json();
        const avatarUrl = getAvatarUrl(user.avatar_seed || user.username);
        container.innerHTML = `
            <div class="card" style="margin:0;">
                <div style="display:flex;align-items:center;gap:15px;margin-bottom:10px;flex-wrap:wrap;">
                    <img src="${avatarUrl}" alt="" class="admin-user-avatar" style="width:48px;height:48px;border-radius:50%;object-fit:cover;">
                    <div>
                        <h3 style="margin-bottom:4px;"><i class="fas fa-user-cog"></i> Пользователь #${user.id} — ${escapeHtml(user.username)}</h3>
                        <div style="font-size:0.9rem;color:#aaa;">@${escapeHtml(user.username)}</div>
                    </div>
                </div>
                <p>Имя: <strong>${escapeHtml(user.display_name || user.username)}</strong></p>
                <p>Создан: ${new Date(user.created_at).toLocaleString('ru')}</p>
                <p>Комментариев: ${commentsCount} • Игр в истории: ${gamesCount}</p>
                <p>Роли:
                    ${user.is_admin ? '<span class="badge badge-admin">admin</span>' : '<span class="badge">user</span>'}
                    ${user.is_banned ? '<span class="badge badge-banned">ban</span>' : ''}
                </p>
                <p>Причина бана: ${user.ban_reason ? escapeHtml(user.ban_reason) : '<span style="color:#888;">нет</span>'}</p>
                <h4 style="margin-top:15px;">Статистика</h4>
                <div class="admin-grid" style="margin-bottom:10px;">
                    <div class="admin-stat"><div class="label">Игр сыграно</div><div class="value" id="statGamesPlayedEdit">${stats.games_played ?? 0}</div></div>
                    <div class="admin-stat"><div class="label">Побед шпион</div><div class="value" id="statSpyWinsEdit">${stats.games_won_as_spy ?? 0}</div></div>
                    <div class="admin-stat"><div class="label">Побед мирный</div><div class="value" id="statCivWinsEdit">${stats.games_won_as_civilian ?? 0}</div></div>
                    <div class="admin-stat"><div class="label">Поражений</div><div class="value" id="statLostEdit">${stats.games_lost ?? 0}</div></div>
                    <div class="admin-stat"><div class="label">Рейтинг</div><div class="value" id="statRatingEdit">${stats.rating ?? 0}</div></div>
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;">
                    <button type="button" class="btn-secondary" style="width:auto;" id="toggleAdminBtn">
                        <i class="fas fa-user-shield"></i> ${user.is_admin ? 'Снять админа' : 'Назначить админом'}
                    </button>
                    <button type="button" class="btn-secondary" style="width:auto;" id="toggleBanBtn">
                        <i class="fas fa-ban"></i> ${user.is_banned ? 'Разбанить' : 'Забанить'}
                    </button>
                    <button type="button" class="btn-secondary" style="width:auto;" id="editStatsBtn">
                        <i class="fas fa-sliders-h"></i> Изменить статистику
                    </button>
                    <button type="button" class="btn-secondary" style="width:auto;color:#ff6b6b;border-color:#ff6b6b;" id="deleteUserBtn">
                        <i class="fas fa-user-slash"></i> Удалить аккаунт (soft)
                    </button>
                </div>
            </div>
        `;
        document.getElementById('toggleAdminBtn')?.addEventListener('click', async () => {
            if (!confirm(user.is_admin ? 'Снять права администратора?' : 'Назначить пользователя администратором?')) return;
            await fetch('/api/admin/users/' + user.id + '/admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_admin: !user.is_admin }),
                credentials: 'same-origin'
            });
            loadUsers();
            loadUserDetails(user.id);
        });
        document.getElementById('toggleBanBtn')?.addEventListener('click', async () => {
            if (!user.is_banned) {
                const reason = prompt('Причина бана (необязательно):', '');
                await fetch('/api/admin/users/' + user.id + '/ban', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ban: true, reason }),
                    credentials: 'same-origin'
                });
            } else {
                await fetch('/api/admin/users/' + user.id + '/ban', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ban: false }),
                    credentials: 'same-origin'
                });
            }
            loadUsers();
            loadUserDetails(user.id);
        });
        document.getElementById('editStatsBtn')?.addEventListener('click', () => {
            openStatsModal(user, stats);
        });
        document.getElementById('deleteUserBtn')?.addEventListener('click', async () => {
            if (!confirm('Пометить аккаунт как удаленный и забанить?')) return;
            await fetch('/api/admin/users/' + user.id, {
                method: 'DELETE',
                credentials: 'same-origin'
            });
            loadUsers();
            container.style.display = 'none';
        });
    } catch {
        container.innerHTML = '<p>Ошибка загрузки пользователя</p>';
    }
}

function initCommentsTab() {
    const reloadBtn = document.getElementById('commentsReloadBtn');
    if (reloadBtn) reloadBtn.addEventListener('click', () => loadComments());
    loadComments();
}

async function loadComments() {
    const table = document.getElementById('commentsTable');
    if (!table) return;
    const q = (document.getElementById('commentsSearch')?.value || '').trim();
    const profileId = document.getElementById('commentsProfileId')?.value;
    const authorId = document.getElementById('commentsAuthorId')?.value;
    table.innerHTML = '<tbody><tr><td>Загрузка...</td></tr></tbody>';
    try {
        const params = new URLSearchParams();
        if (q.length >= 2) params.set('q', q);
        if (profileId) params.set('profile_user_id', profileId);
        if (authorId) params.set('author_user_id', authorId);
        const res = await fetch('/api/admin/comments?' + params.toString(), { credentials: 'same-origin' });
        if (!res.ok) {
            table.innerHTML = '<tbody><tr><td>Ошибка загрузки</td></tr></tbody>';
            return;
        }
        const data = await res.json();
        const rows = data.comments || [];
        let html = '<thead><tr><th>ID</th><th>Профиль</th><th>Автор</th><th>Текст</th><th>Когда</th><th></th></tr></thead><tbody>';
        rows.forEach(c => {
            html += `
                <tr data-comment-id="${c.id}">
                    <td>${c.id}</td>
                    <td><a href="/profile/${c.profile_user_id}" target="_blank">${escapeHtml(c.profile_username || '')}</a></td>
                    <td><a href="/profile/${c.author_user_id}" target="_blank">${escapeHtml(c.author_username || '')}</a></td>
                    <td style="max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(c.text)}">${escapeHtml(c.text)}</td>
                    <td>${new Date(c.created_at).toLocaleString('ru')}</td>
                    <td><button type="button" class="btn-secondary" style="width:auto;font-size:0.8rem;padding:4px 8px;" data-action="delete"><i class="fas fa-trash"></i></button></td>
                </tr>
            `;
        });
        html += '</tbody>';
        table.innerHTML = html;
        table.querySelectorAll('button[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const tr = btn.closest('tr');
                const id = tr?.getAttribute('data-comment-id');
                if (!id) return;
                if (!confirm('Удалить комментарий?')) return;
                await fetch('/api/admin/comments/' + id, { method: 'DELETE', credentials: 'same-origin' });
                loadComments();
            });
        });
    } catch {
        table.innerHTML = '<tbody><tr><td>Ошибка загрузки</td></tr></tbody>';
    }
}

function initLocationsTab() {
    document.getElementById('locationsReloadBtn')?.addEventListener('click', () => loadLocations());
    document.getElementById('locationsBulkDeleteBtn')?.addEventListener('click', () => bulkDeleteLocations());
    loadLocations();
}

async function loadLocations() {
    const table = document.getElementById('locationsTable');
    if (!table) return;
    const userId = document.getElementById('locationsUserId')?.value;
    table.innerHTML = '<tbody><tr><td>Загрузка...</td></tr></tbody>';
    try {
        const params = new URLSearchParams();
        if (userId) params.set('user_id', userId);
        const res = await fetch('/api/admin/user-locations?' + params.toString(), { credentials: 'same-origin' });
        if (!res.ok) {
            table.innerHTML = '<tbody><tr><td>Ошибка загрузки</td></tr></tbody>';
            return;
        }
        const data = await res.json();
        const rows = data.locations || [];
        let html = '<thead><tr><th><input type="checkbox" id="locationsSelectAll"></th><th>ID</th><th>Локация</th><th>Пользователь</th><th>Картинок</th><th>Создана</th></tr></thead><tbody>';
        rows.forEach(l => {
            html += `
                <tr>
                    <td><input type="checkbox" class="locationSelect" value="${l.id}"></td>
                    <td>${l.id}</td>
                    <td>${escapeHtml(l.name)}</td>
                    <td><a href="/profile/${l.user_id}" target="_blank">${escapeHtml(l.username || '')}</a></td>
                    <td>${l.images_count ?? 0}</td>
                    <td>${new Date(l.created_at).toLocaleString('ru')}</td>
                </tr>
            `;
        });
        html += '</tbody>';
        table.innerHTML = html;
        const selectAll = document.getElementById('locationsSelectAll');
        if (selectAll) {
            selectAll.addEventListener('change', () => {
                table.querySelectorAll('.locationSelect').forEach(ch => {
                    ch.checked = selectAll.checked;
                });
            });
        }
    } catch {
        table.innerHTML = '<tbody><tr><td>Ошибка загрузки</td></tr></tbody>';
    }
}

async function bulkDeleteLocations() {
    const table = document.getElementById('locationsTable');
    if (!table) return;
    const ids = Array.from(table.querySelectorAll('.locationSelect:checked')).map(ch => parseInt(ch.value, 10)).filter(Boolean);
    if (!ids.length) {
        alert('Выберите хотя бы одну локацию');
        return;
    }
    if (!confirm(`Удалить ${ids.length} локаций (и их картинки)?`)) return;
    await fetch('/api/admin/user-locations/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
        credentials: 'same-origin'
    });
    loadLocations();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

function getAvatarUrl(seed) {
    if (!seed) return 'https://api.dicebear.com/7.x/avataaars/svg?seed=default&backgroundColor=4db8ff';
    if (typeof seed === 'string' && seed.startsWith('/uploads/')) return seed;
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}&backgroundColor=4db8ff`;
}

let statsModalState = null;

function openStatsModal(user, stats) {
    statsModalState = {
        userId: user.id
    };
    const gpInput = document.getElementById('statsGamesPlayedInput');
    const swInput = document.getElementById('statsSpyWinsInput');
    const cwInput = document.getElementById('statsCivWinsInput');
    const glInput = document.getElementById('statsLostInput');
    const rInput = document.getElementById('statsRatingInput');
    const errEl = document.getElementById('adminStatsError');
    if (gpInput) gpInput.value = stats.games_played ?? 0;
    if (swInput) swInput.value = stats.games_won_as_spy ?? 0;
    if (cwInput) cwInput.value = stats.games_won_as_civilian ?? 0;
    if (glInput) glInput.value = stats.games_lost ?? 0;
    if (rInput) rInput.value = stats.rating ?? 0;
    if (errEl) {
        errEl.textContent = '';
        errEl.style.display = 'none';
    }
    const modal = document.getElementById('adminStatsModal');
    if (modal) modal.classList.add('active');
}

function closeStatsModal() {
    const modal = document.getElementById('adminStatsModal');
    if (modal) modal.classList.remove('active');
    statsModalState = null;
}

async function onSaveStats() {
    if (!statsModalState?.userId) {
        closeStatsModal();
        return;
    }
    const userId = statsModalState.userId;
    const gpInput = document.getElementById('statsGamesPlayedInput');
    const swInput = document.getElementById('statsSpyWinsInput');
    const cwInput = document.getElementById('statsCivWinsInput');
    const glInput = document.getElementById('statsLostInput');
    const rInput = document.getElementById('statsRatingInput');
    const errEl = document.getElementById('adminStatsError');

    const gp = Number(gpInput?.value ?? 0);
    const sw = Number(swInput?.value ?? 0);
    const cw = Number(cwInput?.value ?? 0);
    const gl = Number(glInput?.value ?? 0);
    const r = Number(rInput?.value ?? 0);

    const values = [gp, sw, cw, gl, r];
    if (values.some(v => !Number.isFinite(v) || v < 0)) {
        if (errEl) {
            errEl.textContent = 'Все значения должны быть неотрицательными числами.';
            errEl.style.display = 'block';
            errEl.classList.add('active');
        }
        return;
    }

    try {
        const res = await fetch('/api/admin/users/' + userId + '/stats', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                games_played: gp,
                games_won_as_spy: sw,
                games_won_as_civilian: cw,
                games_lost: gl,
                rating: r
            }),
            credentials: 'same-origin'
        });
        if (!res.ok) {
            throw new Error('Ошибка сохранения');
        }
        closeStatsModal();
        await loadUserDetails(userId);
        await loadAdminSummary();
    } catch (e) {
        if (errEl) {
            errEl.textContent = 'Не удалось сохранить статистику.';
            errEl.style.display = 'block';
            errEl.classList.add('active');
        }
    }
}

