// Управление темой оформления
class ThemeManager {
    constructor() {
        this.theme = localStorage.getItem('theme') || 'light';
        this.applyTheme();
        this.setupSelector();
    }

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.theme);
        
        // Обновляем значение в dropdown
        const select = document.getElementById('theme-select');
        if (select) {
            select.value = this.theme;
        }
    }

    changeTheme(newTheme) {
        this.theme = newTheme;
        localStorage.setItem('theme', this.theme);
        this.applyTheme();
    }

    setupSelector() {
        const select = document.getElementById('theme-select');
        if (select) {
            // Устанавливаем начальное значение
            select.value = this.theme;
            
            // Слушаем изменения
            select.addEventListener('change', (e) => {
                this.changeTheme(e.target.value);
            });
        }
    }
}

// Загрузка и отображение тем
class ThemeLoader {
    constructor() {
        this.themesContainer = document.getElementById('themes-container');
        this.themes = [];
    }

    async loadThemes() {
        try {
            const response = await fetch('data/themes.json');
            this.themes = await response.json();
            this.renderThemes();
        } catch (error) {
            console.error('Ошибка загрузки тем:', error);
            this.showError();
        }
    }

    renderThemes() {
        if (!this.themesContainer) return;

        // Группируем темы по категориям
        const categories = {};
        this.themes.forEach(theme => {
            const cat = theme.category || 'Другое';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(theme);
        });

        // Иконки для категорий
        const categoryIcons = {
            'Литература': '📚',
            'Кино': '🎬',
            'Спорт': '⚽',
            'Игры': '🎮',
            'География': '🌍',
            'Наука и техника': '🔬',
            'История': '📜',
            'Музыка': '🎵',
            'Другое': '📌'
        };

        // Создаём HTML для каждой категории
        let html = '';
        for (const [category, themes] of Object.entries(categories)) {
            const icon = categoryIcons[category] || '📌';
            const categoryId = category.toLowerCase().replace(/\s+/g, '-');
            
            html += `
                <div class="category-section">
                    <button class="category-header" data-category="${categoryId}">
                        <span class="category-icon">${icon}</span>
                        <h2 class="category-title">${category}</h2>
                        <span class="category-count">${themes.length}</span>
                        <span class="category-arrow">▼</span>
                    </button>
                    <div class="category-themes" id="category-${categoryId}">
                        ${themes.map(theme => this.createThemeCard(theme)).join('')}
                    </div>
                </div>
            `;
        }

        this.themesContainer.innerHTML = html;
        this.attachEventListeners();
        this.setupCategoryToggles();
    }
    
    setupCategoryToggles() {
        // Accordion для категорий (только на мобильных)
        const isMobile = window.innerWidth <= 768;
        
        const headers = document.querySelectorAll('.category-header');
        headers.forEach(header => {
            header.addEventListener('click', (e) => {
                e.preventDefault();
                const categoryId = header.dataset.category;
                const content = document.getElementById(`category-${categoryId}`);
                const section = header.parentElement;
                
                // Переключаем expanded класс
                section.classList.toggle('expanded');
                
                // Плавная анимация высоты
                if (section.classList.contains('expanded')) {
                    content.style.maxHeight = content.scrollHeight + 'px';
                } else {
                    content.style.maxHeight = '0';
                }
            });
        });
        
        // На десктопе - раскрываем все сразу
        if (!isMobile) {
            headers.forEach(header => {
                const categoryId = header.dataset.category;
                const content = document.getElementById(`category-${categoryId}`);
                const section = header.parentElement;
                
                section.classList.add('expanded');
                content.style.maxHeight = 'none';
            });
        }
    }
    
    /**
     * Генерация звёздочек сложности
     * @param {number} difficulty - 1, 2 или 3
     * @returns {string} HTML со звёздочками
     */
    getDifficultyStars(difficulty) {
        const level = difficulty || 1;
        const filledStar = '★';
        const emptyStar = '☆';
        
        let stars = '';
        for (let i = 0; i < 3; i++) {
            stars += i < level ? filledStar : emptyStar;
        }
        
        // Текст сложности
        let difficultyText = '';
        if (level === 1) difficultyText = 'Легко';
        else if (level === 2) difficultyText = 'Средне';
        else if (level === 3) difficultyText = 'Сложно';
        
        return `
            <div class="difficulty-indicator" data-level="${level}">
                <span class="difficulty-stars">${stars}</span>
                <span class="difficulty-text">${difficultyText}</span>
            </div>
        `;
    }

    createThemeCard(theme) {
        // Значок ONE-TO-MANY если есть
        const badge = theme.badge ? `<span class="theme-badge">${theme.badge}</span>` : '';
        
        return `
            <div class="theme-card" data-theme-id="${theme.id}">
                <div class="theme-icon-large">${theme.icon}</div>
                <h3 class="theme-title">${theme.title}</h3>
                <div class="theme-description-hover">${theme.description}</div>
                <div class="theme-meta">
                    ${badge}
                    <button class="play-button">Играть</button>
                </div>
            </div>
        `;
    }

    attachEventListeners() {
        const cards = document.querySelectorAll('.theme-card');
        cards.forEach(card => {
            card.addEventListener('click', (e) => {
                const themeId = card.dataset.themeId;
                const theme = this.themes.find(t => t.id === themeId);
                if (theme) {
                    this.handleThemeClick(theme);
                }
            });
        });
        
        // Обработчики модальных окон
        this.setupAuthChoiceModal();
        this.setupDifficultyModal();
    }
    
    /**
     * Обработка клика на тему
     */
    handleThemeClick(theme) {
        // Сохраняем выбранную тему
        this.selectedTheme = theme;
        
        // Проверяем авторизацию
        if (window.authManager && window.authManager.isLoggedIn()) {
            // Пользователь авторизован - сразу показываем выбор сложности
            this.showDifficultyModal(theme);
        } else {
            // Пользователь не авторизован - предлагаем войти или играть без регистрации
            this.showAuthChoiceModal(theme);
        }
    }
    
    /**
     * ═══════════════════════════════════════════════════════════
     * МОДАЛЬНОЕ ОКНО: ВЫБОР АВТОРИЗАЦИИ
     * ═══════════════════════════════════════════════════════════
     */
    
    setupAuthChoiceModal() {
        const modal = document.getElementById('auth-choice-modal');
        if (!modal) return;
        
        const closeBtn = modal.querySelector('.modal-close');
        const overlay = modal.querySelector('.modal-overlay');
        const guestBtn = document.getElementById('play-as-guest-btn');
        
        // Закрытие по кнопке
        closeBtn.addEventListener('click', () => {
            this.hideAuthChoiceModal();
        });
        
        // Закрытие по overlay
        overlay.addEventListener('click', () => {
            this.hideAuthChoiceModal();
        });
        
        // Играть без регистрации
        guestBtn.addEventListener('click', () => {
            this.hideAuthChoiceModal();
            // Показываем выбор сложности
            if (this.selectedTheme) {
                this.showDifficultyModal(this.selectedTheme);
            }
        });
        
        // Закрытие по Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
                this.hideAuthChoiceModal();
            }
        });
    }
    
    showAuthChoiceModal(theme) {
        const modal = document.getElementById('auth-choice-modal');
        if (!modal) return;
        
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
    
    hideAuthChoiceModal() {
        const modal = document.getElementById('auth-choice-modal');
        if (!modal) return;
        
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }

    /**
     * ═══════════════════════════════════════════════════════════
     * МОДАЛЬНОЕ ОКНО ВЫБОРА СЛОЖНОСТИ
     * ═══════════════════════════════════════════════════════════
     */
    
    setupDifficultyModal() {
        const modal = document.getElementById('difficulty-modal');
        const closeBtn = modal.querySelector('.difficulty-close');
        const overlay = modal.querySelector('.difficulty-overlay');
        const difficultyOptions = modal.querySelectorAll('.difficulty-option');
        
        // Закрытие по кнопке
        closeBtn.addEventListener('click', () => {
            this.hideDifficultyModal();
        });
        
        // Закрытие по overlay
        overlay.addEventListener('click', () => {
            this.hideDifficultyModal();
        });
        
        // Закрытие по Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
                this.hideDifficultyModal();
            }
        });
        
        // Обработка выбора сложности
        difficultyOptions.forEach(option => {
            option.addEventListener('click', () => {
                const difficulty = parseInt(option.dataset.difficulty);
                const themeId = modal.dataset.currentTheme;
                
                if (themeId && difficulty) {
                    this.startGameWithDifficulty(themeId, difficulty);
                }
            });
        });
    }
    
    async showDifficultyModal(theme) {
        const modal = document.getElementById('difficulty-modal');
        const icon = modal.querySelector('.difficulty-theme-icon');
        const title = modal.querySelector('.difficulty-theme-title');
        
        // Устанавливаем данные темы
        icon.textContent = theme.icon;
        title.textContent = theme.title;
        modal.dataset.currentTheme = theme.id;
        
        // Загружаем и отображаем прогресс
        await this.loadProgressForDifficulties(theme.id);
        
        // Показываем модальное окно
        modal.classList.remove('hidden');
        
        // Блокируем скролл body
        document.body.style.overflow = 'hidden';
    }
    
    /**
     * Загрузить прогресс для всех сложностей темы
     */
    async loadProgressForDifficulties(themeId) {
        // Очищаем прогресс
        const progressElements = document.querySelectorAll('.difficulty-option-progress');
        progressElements.forEach(el => {
            el.textContent = '';
            el.style.display = 'none';
        });
        
        // Если пользователь не авторизован или нет progressManager - ничего не показываем
        if (!window.progressManager || !window.authManager || !window.authManager.isLoggedIn()) {
            return;
        }
        
        try {
            // Получаем прогресс по всем сложностям
            for (let difficulty = 1; difficulty <= 3; difficulty++) {
                const progress = await progressManager.getThemeProgress(themeId, difficulty);
                
                if (progress && progress.bestAccuracy !== undefined) {
                    const progressEl = document.querySelector(`.difficulty-option-progress[data-difficulty="${difficulty}"]`);
                    if (progressEl) {
                        const accuracy = Math.round(progress.bestAccuracy);
                        progressEl.textContent = `Лучший результат: ${accuracy}% точности`;
                        progressEl.style.display = 'block';
                        progressEl.style.color = accuracy >= 90 ? '#10b981' : accuracy >= 70 ? '#f59e0b' : '#6b7280';
                        progressEl.style.fontWeight = '600';
                    }
                }
            }
        } catch (error) {
            console.error('Ошибка загрузки прогресса:', error);
        }
    }
    
    hideDifficultyModal() {
        const modal = document.getElementById('difficulty-modal');
        modal.classList.add('hidden');
        
        // Возвращаем скролл
        document.body.style.overflow = '';
    }
    
    startGameWithDifficulty(themeId, difficulty) {
        // 🔊 Звук клика при выборе сложности
        if (window.soundManager) {
            window.soundManager.playClick();
        }
        
        // Переход на страницу игры с параметрами темы и сложности
        window.location.href = `game.html?theme=${themeId}&difficulty=${difficulty}`;
    }

    startGame(themeId) {
        // Старый метод для обратной совместимости (по умолчанию средняя сложность)
        this.startGameWithDifficulty(themeId, 2);
    }

    showError() {
        if (!this.themesContainer) return;
        this.themesContainer.innerHTML = `
            <div style="text-align: center; padding: 3rem;">
                <h3 style="color: var(--text-secondary);">
                    Не удалось загрузить темы. Попробуйте обновить страницу.
                </h3>
            </div>
        `;
    }
}

// Дополнительный стиль для категорий
const categoryStyles = `
    /* ═══════════════════════════════════════════════════════
       КАТЕГОРИИ - ДЕСКТОПНАЯ ВЕРСИЯ
       ═══════════════════════════════════════════════════════ */
    
    .category-section {
        margin-bottom: 3rem;
    }
    
    .category-header {
        display: flex;
        align-items: center;
        gap: 1rem;
        width: 100%;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        padding: 1rem 1.5rem;
        cursor: pointer;
        transition: all 0.3s ease;
        margin-bottom: 1.5rem;
    }
    
    .category-header:hover {
        background: var(--bg-card-hover);
        border-color: var(--accent-color);
        transform: translateY(-2px);
        box-shadow: var(--shadow);
    }
    
    .category-icon {
        font-size: 2rem;
        flex-shrink: 0;
    }
    
    .category-title {
        font-size: 1.75rem;
        font-weight: 600;
        color: var(--text-primary);
        margin: 0;
        flex-grow: 1;
        text-align: left;
    }
    
    .category-count {
        background: var(--accent-color);
        color: white;
        font-size: 0.875rem;
        font-weight: 600;
        padding: 0.25rem 0.75rem;
        border-radius: 20px;
        flex-shrink: 0;
    }
    
    .category-arrow {
        font-size: 1.25rem;
        color: var(--text-secondary);
        transition: transform 0.3s ease;
        flex-shrink: 0;
    }
    
    .category-section.expanded .category-arrow {
        transform: rotate(180deg);
    }
    
    .category-themes {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
        gap: 2rem;
        overflow: hidden;
        transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    /* ═══════════════════════════════════════════════════════
       МОБИЛЬНАЯ АДАПТАЦИЯ (<768px)
       ═══════════════════════════════════════════════════════ */
    
    @media (max-width: 768px) {
        .category-section {
            margin-bottom: 1rem;
        }
        
        .category-header {
            padding: 1rem;
            margin-bottom: 0;
            border-radius: 8px;
        }
        
        .category-icon {
            font-size: 1.5rem;
        }
        
        .category-title {
            font-size: 1.25rem;
        }
        
        .category-count {
            font-size: 0.75rem;
            padding: 0.2rem 0.6rem;
        }
        
        .category-arrow {
            font-size: 1rem;
        }
        
        /* Accordion: по умолчанию свёрнуто */
        .category-themes {
            grid-template-columns: 1fr;
            gap: 1rem;
            max-height: 0;
            padding: 0 1rem;
        }
        
        .category-section.expanded .category-themes {
            padding-top: 1rem;
            padding-bottom: 1rem;
        }
        
        /* Плавная анимация раскрытия */
        .category-themes {
            transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1),
                        padding 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
    }
    
    /* ═══════════════════════════════════════════════════════
       ОЧЕНЬ МАЛЕНЬКИЕ ЭКРАНЫ (<375px)
       ═══════════════════════════════════════════════════════ */
    
    @media (max-width: 374px) {
        .category-header {
            padding: 0.75rem;
            gap: 0.75rem;
        }
        
        .category-icon {
            font-size: 1.25rem;
        }
        
        .category-title {
            font-size: 1.1rem;
        }
        
        .category-themes {
            padding: 0 0.75rem;
        }
    }
    
    /* ═══════════════════════════════════════════════════════
       HINT ДЛЯ ПОЛЬЗОВАТЕЛЯ (только на мобильных)
       ═══════════════════════════════════════════════════════ */
    
    @media (max-width: 768px) {
        /* Первый hint при загрузке страницы */
        .category-section:first-child .category-header::after {
            content: '👆 Нажми чтобы раскрыть';
            position: absolute;
            top: -2.5rem;
            right: 0;
            background: var(--accent-color);
            color: white;
            font-size: 0.75rem;
            padding: 0.5rem 0.75rem;
            border-radius: 8px;
            animation: hintPulse 2s ease infinite;
            pointer-events: none;
        }
        
        /* Скрываем hint после первого клика */
        .category-section:first-child.expanded .category-header::after {
            display: none;
        }
        
        @keyframes hintPulse {
            0%, 100% {
                opacity: 1;
                transform: translateY(0);
            }
            50% {
                opacity: 0.7;
                transform: translateY(-5px);
            }
        }
    }
`;

// Добавляем стили динамически
const styleSheet = document.createElement('style');
styleSheet.textContent = categoryStyles;
document.head.appendChild(styleSheet);

// ═══════════════════════════════════════════════════════════
// USER PROFILE UI MANAGER
// ═══════════════════════════════════════════════════════════

class UserProfileUI {
    constructor() {
        this.setupEventListeners();
        this.setupAuthListener();
    }
    
    setupEventListeners() {
        // Toggle dropdown
        const profileToggle = document.getElementById('user-profile-toggle');
        const dropdown = document.getElementById('user-dropdown');
        
        if (profileToggle && dropdown) {
            profileToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('show');
            });
            
            // Закрытие при клике вне
            document.addEventListener('click', () => {
                dropdown.classList.remove('show');
            });
        }
        
        // Кнопка просмотра статистики
        const viewStatsBtn = document.getElementById('view-stats-btn');
        if (viewStatsBtn) {
            viewStatsBtn.addEventListener('click', () => {
                alert('Модальное окно статистики будет добавлено позже');
            });
        }
        
        // Кнопка выхода
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                const result = await window.authManager.logout();
                if (result.success) {
                    window.location.reload();
                }
            });
        }
    }
    
    setupAuthListener() {
        if (window.authManager) {
            authManager.onAuthStateChanged(user => {
                this.updateUI(user);
            });
        }
    }
    
    updateUI(user) {
        const loginBtn = document.getElementById('login-btn');
        const userProfile = document.getElementById('user-profile');
        const userName = document.getElementById('user-name');
        const userNameLarge = document.getElementById('user-name-large');
        const userEmail = document.getElementById('user-email');
        
        if (user) {
            // Показываем профиль
            if (loginBtn) loginBtn.style.display = 'none';
            if (userProfile) userProfile.style.display = 'block';
            if (userName) userName.textContent = user.displayName || 'Игрок';
            if (userNameLarge) userNameLarge.textContent = user.displayName || 'Игрок';
            if (userEmail) userEmail.textContent = user.email;
            
            // Загружаем прогресс
            this.loadProgress();
        } else {
            // Показываем кнопку входа
            if (loginBtn) loginBtn.style.display = 'block';
            if (userProfile) userProfile.style.display = 'none';
        }
    }
    
    async loadProgress() {
        if (!window.progressManager) return;
        
        try {
            const allProgress = await progressManager.getAllProgress();
            console.log('📊 Загружен прогресс:', allProgress);
            
            // Обновляем карточки тем
            this.updateThemeCardsWithProgress(allProgress);
        } catch (error) {
            console.error('❌ Ошибка загрузки прогресса:', error);
        }
    }
    
    updateThemeCardsWithProgress(progressData) {
        const themeCards = document.querySelectorAll('.theme-card');
        
        themeCards.forEach(card => {
            const themeId = card.dataset.themeId;
            
            // Фильтруем прогресс для этой темы
            const themeProgress = progressData.filter(p => p.themeId === themeId);
            
            if (themeProgress.length === 0) return;
            
            // Создаём элемент прогресса
            const progressHTML = this.createProgressHTML(themeProgress);
            
            // Вставляем перед кнопкой "Играть"
            const playButton = card.querySelector('.play-button');
            if (playButton && progressHTML) {
                const progressEl = document.createElement('div');
                progressEl.className = 'theme-progress';
                progressEl.innerHTML = progressHTML;
                playButton.parentNode.insertBefore(progressEl, playButton);
            }
        });
    }
    
    createProgressHTML(themeProgress) {
        let html = '<div class="theme-progress-title">Ваш прогресс:</div>';
        
        // Сортируем по сложности
        const difficulties = [1, 2, 3];
        
        difficulties.forEach(diff => {
            const progress = themeProgress.find(p => p.difficulty === diff);
            const stars = '⭐'.repeat(diff);
            
            if (progress && progress.bestScore) {
                const completed = progress.completed ? ' completed' : '';
                html += `
                    <div class="theme-progress-item">
                        <span class="theme-progress-label">${stars}</span>
                        <span class="theme-progress-value${completed}">${progress.bestScore} очков</span>
                    </div>
                `;
            } else {
                html += `
                    <div class="theme-progress-item">
                        <span class="theme-progress-label">${stars}</span>
                        <span class="theme-progress-value not-completed">—</span>
                    </div>
                `;
            }
        });
        
        return html;
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    new ThemeManager();
    const loader = new ThemeLoader();
    loader.loadThemes();
    
    // Инициализируем UI профиля
    new UserProfileUI();
});
