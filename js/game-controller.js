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
 * @version 4.0
 */

class GameController {
    constructor(model, view) {
        console.log('🎮 Инициализация GameController v4.0');
        
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
            
            // Шаг 4: Выбираем пары по сложности
            const pairs = this.selectPairsByDifficulty(themeData.pairs, difficulty);
            
            if (pairs.length < 6) {
                throw new Error('Недостаточно пар для игры');
            }
            
            // Шаг 5: Инициализируем модель
            this.view.updateLoadingMessage('Подготовка карточек...');
            this.model.themeData = themeData;
            this.model.themeId = themeId;
            this.model.difficulty = difficulty;
            this.model.initializeCards(pairs);
            
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
     * Валидация темы
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
        
        if (themeData.pairs.length < 3) {
            throw new Error(`Слишком мало пар: ${themeData.pairs.length}`);
        }
        
        if (!themeData.title) {
            throw new Error('В теме отсутствует title');
        }
        
        // Валидация пар
        themeData.pairs.forEach((pair, index) => {
            if (!pair.id) {
                throw new Error(`Пара ${index} не имеет id`);
            }
            if (!pair.left || !pair.right) {
                throw new Error(`Пара ${index} не имеет left или right`);
            }
        });
        
        console.log('✅ Тема прошла валидацию');
    }
    
    /**
     * Выбор пар по сложности
     */
    selectPairsByDifficulty(allPairs, difficulty) {
        const easy = allPairs.filter(p => p.difficulty === 1);
        const medium = allPairs.filter(p => p.difficulty === 2);
        const hard = allPairs.filter(p => p.difficulty === 3);
        
        let selected = [];
        
        switch (difficulty) {
            case 1: // Лёгкая: 12 пар
                selected = [
                    ...easy.slice(0, 10),
                    ...medium.slice(0, 2)
                ];
                break;
            
            case 2: // Средняя: 18 пар
                selected = [
                    ...easy.slice(0, 6),
                    ...medium.slice(0, 9),
                    ...hard.slice(0, 3)
                ];
                break;
            
            case 3: // Сложная: 24 пары
                selected = [
                    ...easy.slice(0, 6),
                    ...medium.slice(0, 6),
                    ...hard.slice(0, 12)
                ];
                break;
            
            default:
                selected = allPairs;
        }
        
        // Если не хватило - берём из всех
        if (selected.length < 6) {
            console.warn('Недостаточно пар нужной сложности, берём все');
            selected = allPairs.slice(0, Math.max(12, allPairs.length));
        }
        
        console.log(`✅ Выбрано ${selected.length} пар для сложности ${difficulty}`);
        
        return selected;
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
        
        // Инициализируем drag-drop для новых карточек
        if (window.dragDropManager) {
            window.dragDropManager.init();
            console.log('✅ Drag-drop привязан к карточкам');
        }
        
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
        console.log('✅ Правильное совпадение!');
        
        // Блокируем взаимодействие
        this.view.setInteractionEnabled(false);
        
        // Звук
        if (window.soundManager) {
            window.soundManager.playSuccess();
        }
        
        // Применяем к модели
        this.model.applyMatch(result.card1.id, result.card2.id);
        
        // Анимация
        this.view.showCorrectMatch(result.card1.id, result.card2.id);
        
        // Обновляем UI
        this.updateAllUI();
        
        // Ждём анимацию
        await this.delay(1000);
        
        // Удаляем из view
        this.view.removeMatchedCards([result.card1.id, result.card2.id]);
        
        // Проверяем завершение
        if (this.model.isGameFinished()) {
            await this.delay(500);
            this.handleGameComplete();
            return;
        }
        
        // Добираем новые карточки
        const newCards = this.model.refillBoard();
        
        if (newCards.length > 0) {
            await this.delay(500);
            this.view.addNewCards(newCards);
            
            // Инициализируем drag-drop для новых карточек
            if (window.dragDropManager) {
                window.dragDropManager.init();
            }
        }
        
        // Возвращаем состояние
        this.model.setState('PLAYING');
        this.view.setInteractionEnabled(true);
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
