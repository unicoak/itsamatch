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
 * @version 5.0 - Поддержка множественных правых карточек с разной сложностью
 */

class GameModel {
    constructor() {
        console.log('📊 Инициализация GameModel v5.0');
        
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
     * Инициализация карточек с умным подбором по сложности
     * @param {Array} pairs - Массив пар с множественными правыми карточками
     * @param {Object} distribution - Распределение: { easy: N, medium: N, hard: N }
     */
    initializeCards(pairs, distribution) {
        console.log(`🎴 Инициализация: ${pairs.length} пар источника`);
        console.log(`📊 Распределение:`, distribution);
        
        // 1. УМНЫЙ ПОДБОР: выбираем пары с учётом распределения
        const selectedPairs = this.selectCardsForGame(pairs, distribution);
        
        if (selectedPairs.length === 0) {
            throw new Error('Не удалось подобрать карточки для игры');
        }
        
        this.totalPairs = selectedPairs.length;
        this.cards = [];
        
        // 2. Создаём карточки из выбранных пар
        selectedPairs.forEach((pair, index) => {
            // Левая карточка
            this.cards.push({
                id: `card_left_${pair.pairId}_${index}`,
                pairId: pair.pairId,
                side: 'left',
                text: pair.leftText,
                state: 'pool',
                position: index
            });
            
            // Правая карточка (уже выбранная по сложности)
            this.cards.push({
                id: `card_right_${pair.pairId}_${index}`,
                pairId: pair.pairId,
                side: 'right',
                text: pair.rightText,
                description: pair.rightDescription,
                difficulty: pair.rightDifficulty,
                state: 'pool',
                position: index
            });
        });
        
        // 3. Разделяем по сторонам
        this.poolCards.left = this.cards.filter(c => c.side === 'left');
        this.poolCards.right = this.cards.filter(c => c.side === 'right');
        
        // 4. Перемешиваем пулы
        this.poolCards.left = this.shuffle(this.poolCards.left);
        this.poolCards.right = this.shuffle(this.poolCards.right);
        
        // 5. Гарантируем наличие совпадений на доске
        this.ensureMatchOnBoard();
        
        // 6. Выкладываем на доску
        this.boardCards.left = this.poolCards.left.splice(0, this.CARDS_ON_BOARD);
        this.boardCards.right = this.poolCards.right.splice(0, this.CARDS_ON_BOARD);
        
        // Помечаем как активные
        [...this.boardCards.left, ...this.boardCards.right].forEach(c => {
            c.state = 'active';
        });
        
        console.log(`✅ Создано ${this.cards.length} карточек (${this.totalPairs} пар)`);
        console.log(`📊 На доске: ${this.boardCards.left.length} левых, ${this.boardCards.right.length} правых`);

        if (matches.length === 0) {
            console.error('НЕТ СОВПАДЕНИЙ НА ДОСКЕ ПОСЛЕ ИНИЦИАЛИЗАЦИИ');
            console.error('Левые pairIds:', Array.from(leftPairIds));
            console.error('Правые pairIds:', Array.from(rightPairIds));
        } else {
            console.log('На доске ${matches.length} возможных совпадений:', matches);
        }
    }
    
    /**
     * Умный подбор карточек с учётом распределения сложности
     * @param {Array} pairs - Массив пар с множественными правыми карточками
     * @param {Object} distribution - { easy: N, medium: N, hard: N }
     * @returns {Array} Массив выбранных пар
     */
    selectCardsForGame(pairs, distribution) {
        const { easy = 0, medium = 0, hard = 0 } = distribution;
        const totalNeeded = easy + medium + hard;
        
        console.log(`🎯 Подбор карточек: легких ${easy}, средних ${medium}, сложных ${hard} (всего ${totalNeeded})`);
        
        // 1. Создаём пулы правых карточек по сложности
        const rightCardPools = { 1: [], 2: [], 3: [] };
        
        pairs.forEach(pair => {
            if (!pair.rights || !Array.isArray(pair.rights)) {
                console.warn(`⚠️ Пара ${pair.id} не имеет массива rights`);
                return;
            }
            
            pair.rights.forEach(right => {
                rightCardPools[right.difficulty].push({
                    leftText: pair.left,
                    leftId: pair.id,
                    rightText: right.text,
                    rightDescription: right.description,
                    rightDifficulty: right.difficulty,
                    pairId: pair.id
                });
            });
        });
        
        console.log(`📦 Пулы созданы:`, {
            easy: rightCardPools[1].length,
            medium: rightCardPools[2].length,
            hard: rightCardPools[3].length
        });
        
        // 2. Перемешиваем каждый пул
        [1, 2, 3].forEach(diff => {
            rightCardPools[diff] = this.shuffle(rightCardPools[diff]);
        });
        
        // 3. ГЛАВНЫЙ АЛГОРИТМ: Подбор карточек
        const selectedPairs = [];
        const usedLeftIds = new Set();
        
        // Порядок важен: сначала сложные, потом средние, потом лёгкие
        const pickingOrder = [
            { difficulty: 3, count: hard },
            { difficulty: 2, count: medium },
            { difficulty: 1, count: easy }
        ];
        
        pickingOrder.forEach(({ difficulty: diff, count }) => {
            if (count === 0) return;
            
            console.log(`\n🔍 Выбираем ${count} карточек сложности ${diff}`);
            
            let picked = 0;
            const pool = rightCardPools[diff];
            
            for (let i = 0; i < pool.length && picked < count; i++) {
                const candidate = pool[i];
                
                // Проверка: не использовали ли уже эту левую карточку?
                if (!usedLeftIds.has(candidate.pairId)) {
                    // ✅ Берём эту пару
                    selectedPairs.push(candidate);
                    usedLeftIds.add(candidate.pairId);
                    picked++;
                    
                    console.log(`  ✓ "${candidate.leftText}" → "${candidate.rightText}"`);
                    
                    // 🗑️ КЛЮЧЕВОЙ МОМЕНТ: Удаляем ВСЕ правые карточки этой левой из ВСЕХ пулов
                    [1, 2, 3].forEach(poolDiff => {
                        const before = rightCardPools[poolDiff].length;
                        rightCardPools[poolDiff] = rightCardPools[poolDiff].filter(
                            card => card.pairId !== candidate.pairId
                        );
                        const removed = before - rightCardPools[poolDiff].length;
                        if (removed > 0) {
                            console.log(`    🗑️ Удалено ${removed} из пула сложности ${poolDiff}`);
                        }
                    });
                }
            }
            
            if (picked < count) {
                console.warn(`⚠️ Не хватило карточек сложности ${diff}! Нужно ${count}, получено ${picked}`);
            }
        });
        
        console.log(`\n✅ Итого выбрано: ${selectedPairs.length} пар`);
        
        // Проверка уникальности
        const uniqueLefts = new Set(selectedPairs.map(p => p.pairId));
        console.log(`✓ Уникальных левых карточек: ${uniqueLefts.size}`);
        
        return selectedPairs;
    }
    
    /**
     * Гарантировать наличие совпадения на доске
     * Упрощённая версия - перемешиваем правую сторону до появления совпадения
     */
    ensureMatchOnBoard() {
        let hasMatch = false;
        let attempts = 0;
        const maxAttempts = 100;
        
        while (!hasMatch && attempts < maxAttempts) {
            const leftFirst = this.poolCards.left.slice(0, this.CARDS_ON_BOARD);
            const rightFirst = this.poolCards.right.slice(0, this.CARDS_ON_BOARD);
            
            hasMatch = this.checkAnyMatchExists(leftFirst, rightFirst);
            
            if (!hasMatch) {
                this.poolCards.right = this.shuffle(this.poolCards.right);
                attempts++;
            }
        }
        
        if (attempts > 0) {
            console.log(`🔄 Перемешано ${attempts} раз для гарантии совпадений`);
        }
        
        if (!hasMatch) {
            console.warn('⚠️ Не удалось гарантировать совпадение на доске за 100 попыток');
        }
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
            description: card2.side === 'right' ? card2.description : card1.description
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

                console.log('Проверяем наличие совпадений на доске БЕЗ новой карточки...');
                console.log('Результат проверки hasMatchWithoutNew:', hasMatchWithoutNew);
                console.log('boardCards.left pairIds:', this.boardCards.left.map(c => c.pairId));
                console.log('tempBoardRight pairIds:', tempBoardRight.map(c => c.pairId));


                
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
        console.log('Замены:', replacements.map(r => ({
            action: r.action,
            oldCardId: r.oldCardId,
            newCard: r.newCard ? '${r.newCard.id} (pairId: ${r.newCard.pairId})' : 'нет'
        })));
        console.log('Финальная проверка доски:');
        const leftPairIds = new Set(this.boardCards.left.map(c => c.pairId));
        const rightPairIds = new Set(this.boardCards.right.map(c => c.pairId));
        const matches = [...leftPairIds].filter(id => rightPairIds.has(id));
        console.log('Левые pairIds на доске:', Array.from(leftPairIds));
        console.log('Правые pairIds на доске:', Array.from(rightPairIds));
        if (matches === 0) {
            console.error('КРИТИЧЕСКАЯ ОШИБКА: НЕТ СОВПАДЕНИЙ ПОСЛЕ getReplacements()!');
            console.error('boardCards.left:', this.boardCards.left.map(c => ({id: c.id, pairId: c.pairId})));
            console.error('boardCards.right:', this.boardCards.right.map(c => ({id: c.id, pairId: c.pairId})));
        } else {
            console.log('Совпадений на доскеЖ ${matches.length}', matches);
        }
        
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
