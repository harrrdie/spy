document.addEventListener('DOMContentLoaded', function () {
    const body = document.body;
    const themeToggle = document.getElementById('themeToggle');
    const soundToggleBtn = document.getElementById('soundToggleBtn');
    const emojiToggleBtn = document.getElementById('emojiToggleBtn');
    const emojiRain = document.querySelector('.emoji-rain');

    // ТЕМА
    const savedTheme = localStorage.getItem('spyTheme');
    if (savedTheme === 'light') {
        body.classList.remove('dark-theme');
        body.classList.add('light-theme');
        if (themeToggle) themeToggle.checked = true;
    }

    if (themeToggle) {
        themeToggle.addEventListener('change', () => {
            if (themeToggle.checked) {
                body.classList.remove('dark-theme');
                body.classList.add('light-theme');
                localStorage.setItem('spyTheme', 'light');
            } else {
                body.classList.remove('light-theme');
                body.classList.add('dark-theme');
                localStorage.setItem('spyTheme', 'dark');
            }
        });
    }

    // ЗВУК (только иконка + состояние)
    let soundEnabled = localStorage.getItem('spySoundEnabled') !== 'false';
    function applySoundIcon() {
        if (!soundToggleBtn) return;
        const icon = soundToggleBtn.querySelector('i');
        if (!icon) return;
        if (soundEnabled) {
            icon.className = 'fas fa-volume-up';
            soundToggleBtn.classList.remove('sound-off');
        } else {
            icon.className = 'fas fa-volume-mute';
            soundToggleBtn.classList.add('sound-off');
        }
    }
    applySoundIcon();

    if (soundToggleBtn) {
        soundToggleBtn.addEventListener('click', () => {
            soundEnabled = !soundEnabled;
            localStorage.setItem('spySoundEnabled', soundEnabled);
            applySoundIcon();
        });
    }

    // ЭМОДЗИ
    let emojiEnabled = localStorage.getItem('spyEmojiEnabled') !== 'false';

    function createSpyEmojiRain() {
        if (!emojiRain) return;
        emojiRain.innerHTML = '';
        if (!emojiEnabled) {
            emojiRain.style.display = 'none';
            return;
        }
        emojiRain.style.display = 'block';
        const emojis = ['🕵️', '🕵️‍♂️', '🕵️‍♀️', '🔍', '🗺️', '🎯', '🎭'];
        for (let i = 0; i < 40; i++) {
            const el = document.createElement('div');
            el.className = 'falling-emoji';
            el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
            el.style.left = Math.random() * 100 + '%';
            el.style.animationDuration = 15 + Math.random() * 15 + 's';
            el.style.animationDelay = Math.random() * -30 + 's';
            el.style.fontSize = 20 + Math.random() * 20 + 'px';
            emojiRain.appendChild(el);
        }
    }

    createSpyEmojiRain();

    function applyEmojiIcon() {
        if (!emojiToggleBtn) return;
        const icon = emojiToggleBtn.querySelector('i');
        if (!icon) return;
        icon.className = 'fas fa-cloud-moon';
        if (emojiEnabled) {
            emojiToggleBtn.classList.remove('emoji-off');
        } else {
            emojiToggleBtn.classList.add('emoji-off');
        }
    }
    applyEmojiIcon();

    if (emojiToggleBtn) {
        emojiToggleBtn.addEventListener('click', () => {
            emojiEnabled = !emojiEnabled;
            localStorage.setItem('spyEmojiEnabled', emojiEnabled);
            applyEmojiIcon();
            createSpyEmojiRain();
        });
    }
});

