/**
 * УПРОЩЁННАЯ ИНИЦИАЛИЗАЦИЯ ИГРЫ
 * Надёжная загрузка для всех браузеров (Chrome, Safari, Firefox)
 */

(function() {
    'use strict';
    
    console.log('🔧 game-init.js загружен');
    
    // Ждём загрузки DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGame);
    } else {
        initGame();
    }
    
    async function initGame() {
        console.log('='.repeat(60));
        console.log('🚀 ИНИЦИАЛИЗАЦИЯ ИГРЫ');
        console.log('='.repeat(60));
        
        try {
            // ШАГ 1: Проверка классов
            console.log('Шаг 1: Проверка загрузки классов...');
            checkClasses();
            
            // ШАГ 2: Проверка DOM элементов
            console.log('Шаг 2: Проверка DOM элементов...');
            checkDOMElements();
            
            // ШАГ 3: Получение параметров
            console.log('Шаг 3: Получение параметров из URL...');
            const params = getURLParams();
            console.log('  theme:', params.themeId);
            console.log('  difficulty:', params.difficulty);
            
            // ШАГ 4: Создание MVC компонентов
            console.log('Шаг 4: Создание MVC компонентов...');
            const model = new GameModel();
            console.log('  ✅ GameModel создан');
            
            const view = new GameView();
            console.log('  ✅ GameView создан');
            
            const controller = new GameController(model, view);
            console.log('  ✅ GameController создан');
            
            // Сохраняем глобально
            window.gameController = controller;
            window.gameModel = model;
            window.gameView = view;
            console.log('  ✅ Сохранены в window');
            
            // ШАГ 5: Запуск bootstrap
            console.log('Шаг 5: Запуск bootstrap процесса...');
            await controller.bootstrap(params.themeId, params.difficulty);
            
            console.log('='.repeat(60));
            console.log('✅ ИНИЦИАЛИЗАЦИЯ ЗАВЕРШЕНА УСПЕШНО');
            console.log('='.repeat(60));
            
        } catch (error) {
            console.error('='.repeat(60));
            console.error('💥 КРИТИЧЕСКАЯ ОШИБКА ИНИЦИАЛИЗАЦИИ');
            console.error('='.repeat(60));
            console.error('Ошибка:', error.message);
            console.error('Stack:', error.stack);
            console.error('='.repeat(60));
            
            showFatalError(error);
        }
    }
    
    function checkClasses() {
        const requiredClasses = {
            'GameModel': typeof GameModel !== 'undefined',
            'GameView': typeof GameView !== 'undefined',
            'GameController': typeof GameController !== 'undefined'
        };
        
        const missing = [];
        for (const [name, exists] of Object.entries(requiredClasses)) {
            if (exists) {
                console.log(`  ✅ ${name} загружен`);
            } else {
                console.error(`  ❌ ${name} НЕ загружен`);
                missing.push(name);
            }
        }
        
        if (missing.length > 0) {
            throw new Error(`Не загружены классы: ${missing.join(', ')}`);
        }
    }
    
    function checkDOMElements() {
        const requiredElements = [
            'left-cards',
            'right-cards',
            'score',
            'combo',
            'matched-count',
            'total-count'
        ];
        
        const missing = [];
        for (const id of requiredElements) {
            const el = document.getElementById(id);
            if (el) {
                console.log(`  ✅ #${id} найден`);
            } else {
                console.error(`  ❌ #${id} НЕ найден`);
                missing.push(id);
            }
        }
        
        if (missing.length > 0) {
            throw new Error(`Не найдены элементы: ${missing.join(', ')}`);
        }
    }
    
    function getURLParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const themeId = urlParams.get('theme');
        const difficulty = parseInt(urlParams.get('difficulty')) || 1;
        
        if (!themeId) {
            throw new Error('Не указан параметр theme в URL');
        }
        
        if (difficulty < 1 || difficulty > 3) {
            throw new Error(`Некорректная сложность: ${difficulty} (должна быть 1-3)`);
        }
        
        return { themeId, difficulty };
    }
    
    function showFatalError(error) {
        const html = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.95);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 999999;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            ">
                <div style="
                    background: white;
                    padding: 2rem;
                    border-radius: 16px;
                    max-width: 600px;
                    width: 90%;
                    max-height: 90vh;
                    overflow-y: auto;
                ">
                    <div style="font-size: 3rem; text-align: center; margin-bottom: 1rem;">⚠️</div>
                    <h2 style="text-align: center; margin: 0 0 1rem 0; color: #1f2937;">Критическая ошибка</h2>
                    <p style="text-align: center; color: #6b7280; margin: 0 0 2rem 0;">${error.message}</p>
                    
                    <details style="
                        background: #f3f4f6;
                        padding: 1rem;
                        border-radius: 8px;
                        margin-bottom: 2rem;
                    ">
                        <summary style="cursor: pointer; font-weight: 600; color: #374151;">
                            Техническая информация (для разработчика)
                        </summary>
                        <pre style="
                            margin-top: 1rem;
                            font-size: 0.75rem;
                            white-space: pre-wrap;
                            word-wrap: break-word;
                            color: #1f2937;
                        ">${error.stack || 'Stack trace недоступен'}</pre>
                    </details>
                    
                    <div style="text-align: center;">
                        <button onclick="location.reload()" style="
                            padding: 0.75rem 2rem;
                            background: #2563eb;
                            color: white;
                            border: none;
                            border-radius: 8px;
                            font-size: 1rem;
                            cursor: pointer;
                            margin-right: 0.5rem;
                        ">Попробовать снова</button>
                        <a href="index.html" style="
                            display: inline-block;
                            padding: 0.75rem 2rem;
                            background: #e5e7eb;
                            color: #1f2937;
                            border-radius: 8px;
                            font-size: 1rem;
                            text-decoration: none;
                        ">Вернуться к темам</a>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', html);
    }
})();
