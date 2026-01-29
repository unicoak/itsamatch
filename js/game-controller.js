/**
 * ═══════════════════════════════════════════════════════════════════
 * GAME CONTROLLER - Управление игрой (MVC)
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Отвечает за:
 * - Связь Model ↔ View
 * - Обработку пользовательского ввода
 * - Bootstrap процесс
 * - Координацию игрового процесса
 * 
 * @version 5.0 - Поддержка множественных правых карточек
 */

class GameController {
    constructor(model, view) {
        console.log('🎮 Инициализация GameController v5.0');
        
        this.model = model;
        this.view = view;
        
        // Текущая drag операция
        this.draggedCardId = null;
    }
    
    // ═══════════════════════════════════════════════════════════
    // BOOTSTRAP - Полный процесс загрузки
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Главный метод загрузки игры
     */
    async bootstrap(themeId, difficulty) {
        console.log('🚀 Bootstrap: theme=' + themeId + ', difficulty=' + difficulty);
        
        try {
            // Шаг 1: Показываем загрузку
            this.view.showLoadingScreen('Загрузка темы...');
            if (!this.model.setState('LOADING')) {
                throw new Error('Невозможно начать загрузку');
            }
            
            // Шаг 2: Загружаем тему
            const themeData = await this.loadTheme(themeId);
            
            // Шаг 3: Валидируем тему
            this.view.updateLoadingMessage('Проверка данных...');
            this.validateTheme(themeData);
            
            // Шаг 4: Получаем распределение по сложности
            const distribution = this.getDistributionForDifficulty(difficulty);
            
            console.log(`📊 Для сложности ${difficulty} нужно: легких ${distribution.easy}, средних ${distribution.medium}, сложных ${distribution.hard}`);
            
            // Шаг 5: Инициализируем модель (она сама выберет нужные пары)
            this.view.updateLoadingMessage('Подготовка карточек...');
            this.model.themeData = themeData;
            this.model.themeId = themeId;
            this.model.difficulty = difficulty;
            this.model.initializeCards(themeData.pairs, distribution);
            
            // Шаг 6: Отображаем карточки
            this.view.updateLoadingMessage('Отрисовка...');
            this.view.setGameInfo(themeData);
            this.view.renderCards(this.model.getAllBoardCards());
            
            // Шаг 7: Обновляем UI
            this.updateAllUI();
            
            // Шаг 8: Готовы!
            if (!this.model.setState('READY')) {
                throw new Error('Ошибка перехода в состояние READY');
            }
            
            // Шаг 9: Скрываем загрузку и запускаем
            this.view.hideLoadingScreen();
            
            await this.delay(300); // Плавный переход
            
            this.startGame();
            
            console.log('✅ Bootstrap завершён успешно');
            
        } catch (error) {
            console.error('💥 Ошибка bootstrap:', error);
            
            // Показываем экран ошибки
            this.view.showErrorScreen(
                error.message || 'Не удалось загрузить игру'
            );
            
            // Сбрасываем состояние
            this.model.setState('ERROR');
        }
    }
    
    /**
     * Загрузка темы из JSON
     */
    async loadTheme(themeId) {
        console.log(`📥 Загрузка темы: ${themeId}`);
        
        // Валидация ID
        if (!themeId || typeof themeId !== 'string') {
            throw new Error('Некорректный ID темы');
        }
        
        if (!/^[a-z0-9\-]+$/i.test(themeId)) {
            throw new Error('ID темы содержит недопустимые символы');
        }
        
        // Загрузка
        const response = await fetch(`data/themes/${themeId}.json`);
        
        if (!response.ok) {
            throw new Error(`Тема "${themeId}" не найдена (HTTP ${response.status})`);
        }
        
        const themeData = await response.json();
        
        console.log(`✅ Тема загружена: ${themeData.title}`);
        
        return themeData;
    }
    
    /**
     * Валидация темы (с поддержкой новой структуры)
     */
    validateTheme(themeData) {
        if (!themeData || typeof themeData !== 'object' || Array.isArray(themeData)) {
            throw new Error('Некорректный формат файла темы');
        }
        
        if (!themeData.pairs || !Array.isArray(themeData.pairs)) {
            throw new Error('Поле pairs должно быть массивом');
        }
        
        if (themeData.pairs.length === 0) {
            throw new Error('В теме нет ни одной пары');
        }
        
        if (themeData.pairs.length < 6) {
            throw new Error(`Недостаточно пар в теме (минимум 6, есть ${themeData.pairs.length})`);
        }
        
        if (!themeData.title) {
            throw new Error('В теме отсутствует title');
        }
        
        // Валидация пар (новая структура)
        themeData.pairs.forEach((pair, index) => {
            if (!pair.id) {
                throw new Error(`Пара ${index} не имеет id`);
            }
            if (!pair.left) {
                throw new Error(`Пара ${index} не имеет left`);
            }
            
            // Проверяем новую структуру
            if (!pair.rights || !Array.isArray(pair.rights)) {
                throw new Error(`Пара ${index} не имеет массива rights`);
            }
            
            if (pair.rights.length === 0) {
                throw new Error(`Пара ${index} имеет пустой массив rights`);
            }
            
            // Проверяем каждую правую карточку
            pair.rights.forEach((right, rightIndex) => {
                if (!right.text) {
                    throw new Error(`Пара ${index}, right ${rightIndex} не имеет text`);
                }
                if (!right.difficulty || ![1, 2, 3].includes(right.difficulty)) {
                    throw new Error(`Пара ${index}, right ${rightIndex} имеет некорректную сложность (должна быть 1, 2 или 3)`);
                }
                if (!right.description) {
                    console.warn(`⚠️ Пара ${index}, right ${rightIndex} не имеет description`);
                }
            });
        });
        
        console.log('✅ Тема прошла валидацию');
    }
    
    /**
     * Получить распределение карточек для уровня сложности
     * @param {Number} difficulty - Уровень сложности (1, 2, 3)
     * @returns {Object} { easy: N, medium: N, hard: N }
     */
    getDistributionForDifficulty(difficulty) {
        // Конкретные числа для каждого уровня
        const distributions = {
            1: { easy: 8, medium: 2, hard: 0 },   // Лёгкий: 10 пар (80% лёгкие, 20% средние)
            2: { easy: 4, medium: 8, hard: 2 },    // Средний: 14 пар (29% лёгкие, 57% средние, 14% сложные)
            3: { easy: 2, medium: 6, hard: 10 }    // Сложный: 18 пары (11% лёгкие, 33% средние, 56% сложные)
        };
        
        const distribution = distributions[difficulty];
        
        if (!distribution) {
            console.warn(`⚠️ Неизвестная сложность ${difficulty}, используем средний уровень`);
            return distributions[2];
        }
        
        return distribution;
    }
    
    // ═══════════════════════════════════════════════════════════
    // СТАРТ ИГРЫ
    // ═══════════════════════════════════════════════════════════
    
    startGame() {
        if (!this.model.setState('PLAYING')) {
            console.error('❌ Не удалось запустить игру');
            return;
        }
        
        // Включаем взаимодействие
        this.view.setInteractionEnabled(true);
        
        // Создаём и инициализируем drag-drop для карточек (только один раз)
        if (!window.dragDropManager) {
            window.dragDropManager = new DragDropManager(this);
            console.log('✅ DragDropManager создан');
        }
        
        // Инициализируем обработчики для текущих карточек
        window.dragDropManager.init();
        console.log('✅ Drag-drop привязан к карточкам');
        
        // Запускаем таймер
        this.model.startTime = Date.now();
        
        console.log('🎮 Игра запущена!');
    }
    
    // ═══════════════════════════════════════════════════════════
    // ОБРАБОТКА ВЗАИМОДЕЙСТВИЯ
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Начало перетаскивания карточки
     */
    handleCardDragStart(cardId) {
        if (!this.model.canInteract()) {
            console.warn('⚠️ Взаимодействие запрещено:', this.model.state);
            return false;
        }
        
        this.draggedCardId = cardId;
        console.log('🖱️ Начало drag:', cardId);
        return true;
    }
    
    /**
     * Сброс карточки на цель
     */
    async handleCardDrop(targetCardId) {
        if (!this.draggedCardId || !targetCardId) {
            console.warn('⚠️ Недостаточно данных для проверки');
            return;
        }
        
        if (!this.model.canInteract()) {
            console.warn('⚠️ Взаимодействие запрещено:', this.model.state);
            this.draggedCardId = null;
            return;
        }
        
        console.log('🎯 Drop:', this.draggedCardId, '→', targetCardId);
        
        // Блокируем состояние
        if (!this.model.setState('CHECKING')) {
            console.error('❌ Не удалось перейти в CHECKING');
            this.draggedCardId = null;
            return;
        }
        
        // Проверяем совпадение через модель
        const result = this.model.checkMatch(this.draggedCardId, targetCardId);
        
        if (!result.success) {
            // Ошибка проверки
            console.error('❌ Ошибка checkMatch:', result.error);
            this.model.setState('PLAYING');
            this.draggedCardId = null;
            return;
        }
        
        if (result.isMatch) {
            await this.handleCorrectMatch(result);
        } else {
            await this.handleIncorrectMatch(result);
        }
        
        this.draggedCardId = null;
    }
    
    /**
     * Обработка правильного совпадения
     */
    async handleCorrectMatch(result) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ НАЧАЛО: Правильное совпадение!');
        console.log('   Card 1:', result.card1.id, '→', result.card1.text);
        console.log('   Card 2:', result.card2.id, '→', result.card2.text);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        // Блокируем взаимодействие
        console.log('🔒 Блокировка взаимодействия');
        this.view.setInteractionEnabled(false);
        
        // Звук
        if (window.soundManager) {
            console.log('🔊 Воспроизведение звука успеха');
            window.soundManager.playSuccess();
        }
        
        // Применяем к модели (помечает как matched, но НЕ удаляет с доски)
        console.log('📝 Обновление модели (помечаем карточки как matched)');
        this.model.applyMatch(result.card1.id, result.card2.id);
        
        // Анимация совпадения (зелёная вспышка)
        console.log('🎨 Запуск зелёной анимации');
        this.view.showCorrectMatch(result.card1.id, result.card2.id);
        
        // Показываем описание пары
        if (result.description) {
            console.log('💬 Показ описания пары:', result.description.substring(0, 50) + '...');
            this.view.showMatchDescription(result.description);
        }
        
        // Обновляем UI (счёт, комбо)
        console.log('📊 Обновление UI (счёт, комбо)');
        this.updateAllUI();
        
        // Ждём завершения всех анимаций
        console.log('⏳ Ожидание завершения анимаций (1000ms)...');
        await this.delay(1000);
        console.log('✓ Анимации завершены');
        
        // Проверяем завершение игры
        if (this.model.isGameFinished()) {
            console.log('🏁 Игра завершена!');
            await this.delay(500);
            this.handleGameComplete();
            return;
        }
        
        // Получаем замены для совпавших карточек
        console.log('🔄 Запрос замен для совпавших карточек...');
        const replacements = this.model.getReplacements(result.card1.id, result.card2.id);
        console.log('📦 Получено замен:', replacements.length);
        
        // Очищаем состояние drag-drop перед заменами
        if (window.dragDropManager) {
            console.log('🧹 Очистка состояния drag-drop перед заменами');
            window.dragDropManager.reset();
        }
        
        // Применяем замены/удаления
        console.log('━━━ НАЧАЛО ЗАМЕН ━━━');
        replacements.forEach((replacement, index) => {
            console.log(`\n🔹 Замена ${index + 1}/${replacements.length}:`);
            console.log('   Действие:', replacement.action);
            console.log('   Старая карточка:', replacement.oldCardId);
            
            if (replacement.action === 'replace') {
                console.log('   Новая карточка:', replacement.newCard.id, '→', replacement.newCard.text);
                console.log('   Сторона:', replacement.newCard.side);
                
                // Есть новая карточка - заменяем напрямую
                console.log('   ➜ Замена в DOM...');
                this.view.replaceCard(replacement.oldCardId, replacement.newCard);
                console.log('   ✓ DOM обновлён');
                
                // Инициализируем drag-drop ТОЛЬКО для этой новой карточки
                if (window.dragDropManager) {
                    const newCardEl = document.getElementById(replacement.newCard.id);
                    if (newCardEl) {
                        console.log('   ➜ Добавление обработчиков событий...');
                        if (replacement.newCard.side === 'right') {
                            window.dragDropManager.addRightCardListeners(newCardEl);
                            console.log('   ✓ Правые обработчики добавлены');
                        } else if (replacement.newCard.side === 'left') {
                            window.dragDropManager.addLeftCardListeners(newCardEl);
                            console.log('   ✓ Левые обработчики добавлены');
                        }
                    } else {
                        console.warn('   ⚠️ Карточка не найдена в DOM!');
                    }
                }
            } else if (replacement.action === 'remove') {
                console.log('   ➜ Удаление карточки (пул пуст)...');
                // Пул пуст - удаляем карточку (grid коллапсирует)
                this.view.removeCard(replacement.oldCardId);
                console.log('   ✓ Карточка удалена');
            }
        });
        console.log('━━━ КОНЕЦ ЗАМЕН ━━━\n');
        
        // Возвращаем состояние
        console.log('🔓 Разблокировка взаимодействия');
        this.model.setState('PLAYING');
        this.view.setInteractionEnabled(true);
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ КОНЕЦ: Обработка совпадения завершена');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }
    
    /**
     * Обработка неправильного совпадения
     */
    async handleIncorrectMatch(result) {
        console.log('❌ Неправильное совпадение');
        
        // Блокируем взаимодействие
        this.view.setInteractionEnabled(false);
        
        // Звук
        if (window.soundManager) {
            window.soundManager.playError();
        }
        
        // Применяем к модели
        this.model.applyMismatch();
        
        // Анимация
        this.view.showIncorrectMatch(result.card1.id, result.card2.id);
        
        // Обновляем UI
        this.updateAllUI();
        
        // Ждём анимацию
        await this.delay(800);
        
        // Возвращаем состояние
        this.model.setState('PLAYING');
        this.view.setInteractionEnabled(true);
    }
    
    /**
     * Завершение игры
     */
    handleGameComplete() {
        console.log('🎉 Игра завершена!');
        
        // Устанавливаем состояние
        this.model.setState('FINISHED');
        this.model.endTime = Date.now();
        
        // Звук
        if (window.soundManager) {
            window.soundManager.playVictory();
        }
        
        // Получаем результаты
        const results = this.model.getResults();
        
        // Показываем экран завершения
        this.view.showCompletionScreen(results);
        
        // Сохраняем прогресс
        this.saveProgress(results);
    }
    
    // ═══════════════════════════════════════════════════════════
    // ОБНОВЛЕНИЕ UI
    // ═══════════════════════════════════════════════════════════
    
    updateAllUI() {
        this.view.updateScore(this.model.score);
        this.view.updateCombo(this.model.combo);
        this.view.updateProgress(
            this.model.matchedPairsCount,
            this.model.totalPairs
        );
    }
    
    // ═══════════════════════════════════════════════════════════
    // СОХРАНЕНИЕ ПРОГРЕССА
    // ═══════════════════════════════════════════════════════════
    
    saveProgress(results) {
        if (!window.progressManager || !window.authManager || !window.authManager.isLoggedIn()) {
            console.log('⚠️ Прогресс не сохранён - пользователь не вошёл');
            return;
        }
        
        console.log('💾 Сохраняем прогресс:', results);
        
        window.progressManager.saveGameResult(
            this.model.themeId,
            this.model.difficulty,
            results
        );
    }
    
    // ═══════════════════════════════════════════════════════════
    // УТИЛИТЫ
    // ═══════════════════════════════════════════════════════════
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Экспорт
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameController;
}