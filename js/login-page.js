/**
 * ═══════════════════════════════════════════════════════════════════
 * LOGIN PAGE SCRIPT
 * ═══════════════════════════════════════════════════════════════════
 */

// Переключение между вкладками
const tabs = document.querySelectorAll('.auth-tab');
const forms = document.querySelectorAll('.auth-form');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        
        // Обновляем активные вкладки
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Показываем нужную форму
        forms.forEach(form => {
            if (form.id === `${tabName}-form`) {
                form.classList.add('active');
            } else {
                form.classList.remove('active');
            }
        });
    });
});

// Форма входа
document.getElementById('login-form-element').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const messageEl = document.getElementById('login-message');
    
    // Показываем загрузку
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Вход...';
    
    // Выполняем вход
    const result = await authManager.login(email, password);
    
    // Показываем результат
    messageEl.className = 'auth-message show ' + (result.success ? 'success' : 'error');
    messageEl.textContent = result.success ? result.message : result.error;
    
    submitBtn.disabled = false;
    submitBtn.textContent = 'Войти';
    
    // Редирект при успехе
    if (result.success) {
        setTimeout(() => {
            window.location.href = 'themes.html';
        }, 1500);
    }
});

// Форма регистрации
document.getElementById('register-form-element').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const passwordConfirm = document.getElementById('register-password-confirm').value;
    const messageEl = document.getElementById('register-message');
    
    // Проверка совпадения паролей
    if (password !== passwordConfirm) {
        messageEl.className = 'auth-message show error';
        messageEl.textContent = 'Пароли не совпадают';
        return;
    }
    
    // Показываем загрузку
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Регистрация...';
    
    // Выполняем регистрацию
    const result = await authManager.register(email, password, name);
    
    // Показываем результат
    messageEl.className = 'auth-message show ' + (result.success ? 'success' : 'error');
    messageEl.textContent = result.success ? result.message : result.error;
    
    submitBtn.disabled = false;
    submitBtn.textContent = 'Создать аккаунт';
    
    // Редирект при успехе
    if (result.success) {
        setTimeout(() => {
            window.location.href = 'themes.html';
        }, 1500);
    }
});

// Кнопки "Играть без регистрации"
document.querySelectorAll('[id^="guest-btn"]').forEach(btn => {
    btn.addEventListener('click', () => {
        window.location.href = 'themes.html';
    });
});

// Забыли пароль
document.querySelector('.forgot-password').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('reset-password-modal').classList.remove('hidden');
});

// Закрытие модального окна сброса пароля
document.querySelector('.reset-close').addEventListener('click', () => {
    document.getElementById('reset-password-modal').classList.add('hidden');
});

document.querySelector('.reset-overlay').addEventListener('click', () => {
    document.getElementById('reset-password-modal').classList.add('hidden');
});

// Форма сброса пароля
document.getElementById('reset-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('reset-email').value;
    const messageEl = document.getElementById('reset-message');
    
    const result = await authManager.resetPassword(email);
    
    messageEl.className = 'auth-message show ' + (result.success ? 'success' : 'error');
    messageEl.textContent = result.success ? result.message : result.error;
    
    if (result.success) {
        setTimeout(() => {
            document.getElementById('reset-password-modal').classList.add('hidden');
        }, 3000);
    }
});
