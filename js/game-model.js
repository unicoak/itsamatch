/**
 * ═══════════════════════════════════════════════════════════════════
 * GAME MODEL - Чистая модель данных
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Принципы:
 * - НЕ знает ничего о DOM
 * - Только данные и бизнес-логика
 * - Легко тестируется
 * - Переиспользуется (мобильная версия, Telegram)
 * 
 * @version 4.0
 */

class GameModel {
    constructor() {
        console.log('📊 Инициализация GameModel v4.0');
        
        // ═══════════════════════════════════════════════════════
        // FSM - СОСТОЯНИЕ ИГРЫ
        // ═══════════════════════════════════════════════════════
        
        /**
         * state - Текущее состояние (Finite State Machine)
         * 
         * Возможные состояния:
         * - IDLE: Начальное состояние
         * - LOADING: Загрузка темы
         * - READY: Готов к старту
         * - PLAYING: Игра идёт
         * - CHECKING: Проверка совпадения (блокировка)
         * - FINISHED: Игра завершена
         * - ERROR: Ошибка
         */
        this.state = 'IDLE';
        this.stateHistory = ['IDLE'];
        
        // ═══════════════════════════════════════════════════════
        // ДАННЫЕ ТЕМЫ
        // ═══════════════════════════════════════════════════════
        
        this.themeData = null;
        this.themeId = null;
        this.difficulty = 1;
        
        // ═══════════════════════════════════════════════════════
        // КАРТОЧКИ (МОДЕЛЬ - НЕ DOM!)
        // ═══════════════════════════════════════════════════════
        
        /**
         * cards - Массив ВСЕХ карточек
         * Структура: {id, pairId, side, text, state, position}
         */
        this.cards = [];
        
        /**
         * Карточки на доске и в пуле
         */
        this.boardCards = { left: [], right: [] };
        this.poolCards = { left: [], right: [] };
        
        // ═══════════════════════════════════════════════════════
        // СТАТИСТИКА
        // ═══════════════════════════════════════════════════════
        
        this.score = 0;
        this.correctAnswers = 0;
        this.incorrectAnswers = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.matchedPairsCount = 0;
        this.totalPairs = 0;
        
        this.startTime = null;
        this.endTime = null;
        
        // ═══════════════════════════════════════════════════════
        // КОНСТАНТЫ
        // ═══════════════════════════════════════════════════════
        
        this.SCORE_CORRECT = 50;
        this.SCORE_INCORRECT = -10;
        this.COMBO_BONUS = 10;
        this.CARDS_ON_BOARD = 6; // Пар на доске
    }
    
    // ═══════════════════════════════════════════════════════════
    // FSM - УПРАВЛЕНИЕ СОСТОЯНИЕМ
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Изменить состояние с валидацией
     */
    setState(newState) {
        const validTransitions = {
            'IDLE': ['LOADING', 'ERROR'],
            'LOADING': ['READY', 'ERROR'],
            'READY': ['PLAYING', 'ERROR'],
            'PLAYING': ['CHECKING', 'FINISHED', 'ERROR'],
            'CHECKING': ['PLAYING', 'FINISHED', 'ERROR'],
            'FINISHED': ['IDLE'],
            'ERROR': ['IDLE', 'LOADING']
        };
        
        const allowed = validTransitions[this.state];
        
        if (!allowed || !allowed.includes(newState)) {
            console.error(`❌ Недопустимый переход: ${this.state} → ${newState}`);
            return false;
        }
        
        console.log(`🔄 FSM: ${this.state} → ${newState}`);
        this.state = newState;
        this.stateHistory.push(newState);
        
        return true;
    }
    
    /**
     * Можно ли взаимодействовать с игрой
     */
    canInteract() {
        return this.state === 'PLAYING';
    }
    
    /**
     * Идёт ли проверка совпадения
     */
    isProcessing() {
        return this.state === 'CHECKING';
    }
    
    // ═══════════════════════════════════════════════════════════
    // ИНИЦИАЛИЗАЦИЯ КАРТОЧЕК
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Создать карточки из пар
     */
    initializeCards(pairs) {
        console.log(`🎴 Инициализация: ${pairs.length} пар`);
        
        this.cards = [];
        this.totalPairs = pairs.length;
        
        // Создаём карточки (без перемешивания пар - это избыточно)
        pairs.forEach((pair, index) => {
            this.cards.push({
                id: `card_left_${index}`,
                pairId: pair.id,
                side: 'left',
                text: pair.left,
                description: pair.description || '', // Сохраняем описание пары
                state: 'pool',
                position: index
            });
            
            this.cards.push({
                id: `card_right_${index}`,
                pairId: pair.id,
                side: 'right',
                text: pair.right,
                description: pair.description || '', // Сохраняем описание пары
                state: 'pool',
                position: index
            });
        });
        
        // Разделяем по сторонам
        this.poolCards.left = this.cards.filter(c => c.side === 'left');
        this.poolCards.right = this.cards.filter(c => c.side === 'right');
        
        // Перемешиваем пулы
        this.poolCards.left = this.shuffle(this.poolCards.left);
        this.poolCards.right = this.shuffle(this.poolCards.right);
        
        // Гарантируем наличие хотя бы одной пары в первых CARDS_ON_BOARD карточках
        let hasMatch = false;
        let attempts = 0;
        const maxAttempts = 100;
        
        while (!hasMatch && attempts < maxAttempts) {
            // Проверяем есть ли совпадения в первых CARDS_ON_BOARD карточках
            const leftFirst = this.poolCards.left.slice(0, this.CARDS_ON_BOARD);
            const rightFirst = this.poolCards.right.slice(0, this.CARDS_ON_BOARD);
            
            for (let leftCard of leftFirst) {
                for (let rightCard of rightFirst) {
                    if (leftCard.pairId === rightCard.pairId) {
                        hasMatch = true;
                        break;
                    }
                }
                if (hasMatch) break;
            }
            
            // Если совпадений нет, перемешиваем правую сторону заново
            if (!hasMatch) {
                this.poolCards.right = this.shuffle(this.poolCards.right);
                attempts++;
            }
        }
        
        if (attempts > 0) {
            console.log(`🔄 Перемешано ${attempts} раз для гарантии совпадений`);
        }
        
        // Выводим на доску
        this.boardCards.left = this.poolCards.left.splice(0, this.CARDS_ON_BOARD);
        this.boardCards.right = this.poolCards.right.splice(0, this.CARDS_ON_BOARD);
        
        // Помечаем как активные
        [...this.boardCards.left, ...this.boardCards.right].forEach(c => {
            c.state = 'active';
        });
        
        console.log(`✅ Карточки: ${this.cards.length} всего, ${this.boardCards.left.length * 2} на доске`);
    }
    
    /**
     * Получить все карточки на доске
     */
    getAllBoardCards() {
        return [...this.boardCards.left, ...this.boardCards.right];
    }
    
    // ═══════════════════════════════════════════════════════════
    // ПРОВЕРКА СОВПАДЕНИЙ (ЧИСТАЯ ЛОГИКА)
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Проверить совпадение двух карточек
     * ЧИСТАЯ ФУНКЦИЯ - работает только с моделью
     */
    checkMatch(cardId1, cardId2) {
        // Находим в модели
        const card1 = this.cards.find(c => c.id === cardId1);
        const card2 = this.cards.find(c => c.id === cardId2);
        
        // Валидация
        if (!card1 || !card2) {
            console.error('❌ Карточка не найдена:', cardId1, cardId2);
            return { success: false, error: 'NOT_FOUND' };
        }
        
        if (card1.state !== 'active' || card2.state !== 'active') {
            console.warn('⚠️ Карточка не активна');
            return { success: false, error: 'NOT_ACTIVE' };
        }
        
        if (card1.side === card2.side) {
            console.warn('⚠️ Карточки с одной стороны');
            return { success: false, error: 'SAME_SIDE' };
        }
        
        // ПРОВЕРКА СОВПАДЕНИЯ (на модели!)
        const isMatch = card1.pairId === card2.pairId;
        
        if (isMatch) {
            console.log(`✅ СОВПАДЕНИЕ! Пара ${card1.pairId}`);
        } else {
            console.log(`❌ НЕ совпадение: ${card1.pairId} ≠ ${card2.pairId}`);
        }
        
        return {
            success: true,
            isMatch,
            card1,
            card2,
            pairId: card1.pairId,
            description: card1.description // Добавляем описание пары
        };
    }
    
    /**
     * Применить успешное совпадение
     */
    applyMatch(cardId1, cardId2) {
        const card1 = this.cards.find(c => c.id === cardId1);
        const card2 = this.cards.find(c => c.id === cardId2);
        
        if (!card1 || !card2) return false;
        
        // Помечаем как найденные
        card1.state = 'matched';
        card2.state = 'matched';
        
        // НЕ удаляем с доски - они будут заменены новыми карточками
        // Или удалены если пул пуст
        
        
        // Обновляем счётчики
        this.correctAnswers++;
        this.matchedPairsCount++;
        this.combo++;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        
        // Очки
        const baseScore = this.SCORE_CORRECT;
        // Бонус комбо начинается с 5 совпадений
        const comboBonus = this.combo >= 5 ? (this.combo - 4) * this.COMBO_BONUS : 0;
        this.score += baseScore + comboBonus;
        
        console.log(`📊 Очки: +${baseScore + comboBonus}, combo: ${this.combo}, найдено: ${this.matchedPairsCount}/${this.totalPairs}`);
        
        return true;
    }
    
    /**
     * Применить ошибку
     */
    applyMismatch() {
        this.incorrectAnswers++;
        this.score = Math.max(0, this.score + this.SCORE_INCORRECT);
        this.combo = 0;
        
        console.log(`📊 Ошибка: ${this.SCORE_INCORRECT} очков, combo сброшено`);
    }
    
    /**
     * Получить замену для совпавших карточек
     * Возвращает объект с информацией о замене или удалении
     */
    getReplacements(cardId1, cardId2) {
        const replacements = [];
        
        // Определяем какая карточка с какой стороны
        const card1 = this.cards.find(c => c.id === cardId1);
        const card2 = this.cards.find(c => c.id === cardId2);
        
        if (!card1 || !card2) return replacements;
        
        // Для левой карточки
        if (card1.side === 'left' || card2.side === 'left') {
            const oldCardId = card1.side === 'left' ? cardId1 : cardId2;
            
            if (this.poolCards.left.length > 0) {
                // Есть замена - берём новую карточку
                const newCard = this.poolCards.left.shift();
                newCard.state = 'active';
                
                // Заменяем в boardCards массиве
                const index = this.boardCards.left.findIndex(c => c.id === oldCardId);
                if (index >= 0) {
                    this.boardCards.left[index] = newCard;
                }
                
                replacements.push({
                    action: 'replace',
                    oldCardId: oldCardId,
                    newCard: newCard
                });
            } else {
                // Нет замены - нужно удалить
                this.boardCards.left = this.boardCards.left.filter(c => c.id !== oldCardId);
                
                replacements.push({
                    action: 'remove',
                    oldCardId: oldCardId
                });
            }
        }
        
        // Для правой карточки
        if (card1.side === 'right' || card2.side === 'right') {
            const oldCardId = card1.side === 'right' ? cardId1 : cardId2;
            
            if (this.poolCards.right.length > 0) {
                // Проверяем, останутся ли совпадения после замены
                const tempBoardRight = this.boardCards.right.filter(c => c.id !== oldCardId);
                const hasMatchWithoutNew = this.checkAnyMatchExists(this.boardCards.left, tempBoardRight);
                
                let newCard;
                
                if (!hasMatchWithoutNew) {
                    // Нет совпадений без новой карточки - нужно гарантировать совпадение
                    console.log('⚠️ Нет совпадений на доске, ищем карточку с гарантией совпадения');
                    newCard = this.findMatchingCard(this.poolCards.right, this.boardCards.left);
                    
                    if (!newCard) {
                        // Если не нашли совпадающую, берём первую (край редкий случай)
                        console.warn('⚠️ Не найдено совпадающей карточки в пуле, берём первую');
                        newCard = this.poolCards.right.shift();
                    } else {
                        // Удаляем найденную карточку из пула
                        this.poolCards.right = this.poolCards.right.filter(c => c.id !== newCard.id);
                        console.log(`✓ Найдена совпадающая карточка: ${newCard.id} (pairId: ${newCard.pairId})`);
                    }
                } else {
                    // Есть другие совпадения, берём первую карточку из пула
                    newCard = this.poolCards.right.shift();
                }
                
                newCard.state = 'active';
                
                // Заменяем в boardCards массиве
                const index = this.boardCards.right.findIndex(c => c.id === oldCardId);
                if (index >= 0) {
                    this.boardCards.right[index] = newCard;
                }
                
                replacements.push({
                    action: 'replace',
                    oldCardId: oldCardId,
                    newCard: newCard
                });
            } else {
                // Нет замены - нужно удалить
                this.boardCards.right = this.boardCards.right.filter(c => c.id !== oldCardId);
                
                replacements.push({
                    action: 'remove',
                    oldCardId: oldCardId
                });
            }
        }
        
        console.log(`🔄 Подготовлено замен: ${replacements.length}`);
        return replacements;
    }
    
    // ═══════════════════════════════════════════════════════════
    // ЗАВЕРШЕНИЕ ИГРЫ
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Проверить завершена ли игра
     */
    isGameFinished() {
        return this.matchedPairsCount >= this.totalPairs;
    }
    
    /**
     * Получить результаты
     */
    getResults() {
        const duration = this.endTime && this.startTime ?
            Math.floor((this.endTime - this.startTime) / 1000) : 0;
        
        const accuracy = this.correctAnswers > 0 ?
            Math.round((this.correctAnswers / (this.correctAnswers + this.incorrectAnswers)) * 100) : 100;
        
        return {
            score: this.score,
            correct: this.correctAnswers,
            incorrect: this.incorrectAnswers,
            accuracy,
            maxCombo: this.maxCombo,
            duration,
            completed: this.isGameFinished()
        };
    }
    
    // ═══════════════════════════════════════════════════════════
    // УТИЛИТЫ
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Fisher-Yates shuffle
     */
    shuffle(array) {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }
    
    /**
     * Проверить, есть ли хотя бы одно совпадение между двумя массивами карточек
     */
    checkAnyMatchExists(leftCards, rightCards) {
        for (let leftCard of leftCards) {
            for (let rightCard of rightCards) {
                if (leftCard.pairId === rightCard.pairId) {
                    return true;
                }
            }
        }
        return false;
    }
    
    /**
     * Найти карточку из пула, которая совпадает с любой карточкой на доске
     */
    findMatchingCard(poolCards, boardCards) {
        for (let poolCard of poolCards) {
            for (let boardCard of boardCards) {
                if (poolCard.pairId === boardCard.pairId) {
                    return poolCard;
                }
            }
        }
        return null;
    }
    
    /**
     * Сброс к начальному состоянию
     */
    reset() {
        this.state = 'IDLE';
        this.stateHistory = ['IDLE'];
        this.cards = [];
        this.boardCards = { left: [], right: [] };
        this.poolCards = { left: [], right: [] };
        this.score = 0;
        this.correctAnswers = 0;
        this.incorrectAnswers = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.matchedPairsCount = 0;
        this.totalPairs = 0;
        this.startTime = null;
        this.endTime = null;
        
        console.log('🔄 Модель сброшена');
    }
}

// Экспорт для тестирования
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameModel;
}