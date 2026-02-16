// Переключение вкладок Вход/Регистрация
document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab + 'Form').classList.add('active');
        clearErrors();
    });
});

function clearErrors() {
    document.getElementById('loginError').classList.remove('active');
    document.getElementById('registerError').classList.remove('active');
}

function showError(formId, message) {
    const el = document.getElementById(formId + 'Error');
    el.textContent = message;
    el.classList.add('active');
}

// Вход
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
            credentials: 'same-origin'
        });
        const data = await res.json();

        if (data.success) {
            window.location.href = '/';
        } else {
            showError('login', data.error || 'Ошибка входа');
        }
    } catch (err) {
        showError('login', 'Ошибка подключения к серверу');
    }
});

// Регистрация
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value;
    const passwordConfirm = document.getElementById('regPasswordConfirm').value;

    if (password !== passwordConfirm) {
        showError('register', 'Пароли не совпадают');
        return;
    }

    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
            credentials: 'same-origin'
        });
        const data = await res.json();

        if (data.success) {
            window.location.href = '/';
        } else {
            showError('register', data.error || 'Ошибка регистрации');
        }
    } catch (err) {
        showError('register', 'Ошибка подключения к серверу');
    }
});
