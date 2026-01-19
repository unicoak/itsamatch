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

        // Создаём HTML для каждой категории
        let html = '';
        for (const [category, themes] of Object.entries(categories)) {
            html += `
                <div class="category-section">
                    <h2 class="category-title">${category}</h2>
                    <div class="category-themes">
                        ${themes.map(theme => this.createThemeCard(theme)).join('')}
                    </div>
                </div>
            `;
        }

        this.themesContainer.innerHTML = html;
        this.attachEventListeners();
    }

    createThemeCard(theme) {
        return `
            <div class="theme-card" data-theme-id="${theme.id}">
                <div class="theme-icon-large">${theme.icon}</div>
                <h3 class="theme-title">${theme.title}</h3>
                <div class="theme-description-hover">${theme.description}</div>
                <div class="theme-meta">
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
                this.startGame(themeId);
            });
        });
    }

    startGame(themeId) {
        // Переход на страницу игры с параметром темы
        window.location.href = `game.html?theme=${themeId}`;
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
    .category-section {
        margin-bottom: 3rem;
    }
    
    .category-title {
        font-size: 1.75rem;
        font-weight: 600;
        margin-bottom: 1.5rem;
        color: var(--text-primary);
    }
    
    .category-themes {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
        gap: 2rem;
    }
    
    @media (max-width: 768px) {
        .category-themes {
            grid-template-columns: 1fr;
        }
    }
`;

// Добавляем стили динамически
const styleSheet = document.createElement('style');
styleSheet.textContent = categoryStyles;
document.head.appendChild(styleSheet);

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    new ThemeManager();
    const loader = new ThemeLoader();
    loader.loadThemes();
});
