/**
 * Игровой движок - Потоковая модель с пулами
 * Гарантирует наличие совместимых пар на доске в любой момент
 */

class GameEngine {
    constructor() {
        this.themeData = null;
        this.allPairs = [];
        this.matchedPairs = new Set();
        
        // Потоковая модель с пулами
        this.leftPool = [];    // Пул левых карточек
        this.rightPool = [];   // Пул правых карточек (перемешанные)
        this.leftCards = [];   // Карточки на доске (слева)
        this.rightCards = [];  // Карточки на доске (справа)
        this.maxCardsPerColumn = 6; // Фиксированная сетка 2×6
        
        // Флаг для предотвращения race conditions
        this.isProcessing = false;
        
        // Система очков
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.correctAnswers = 0;
        this.incorrectAnswers = 0;
        
        // DOM элементы (с проверкой существования)
        this.leftContainer = null;
        this.rightContainer = null;
        this.matchedCountEl = null;
        this.totalCountEl = null;
        this.completionScreen = null;
        this.scoreEl = null;
        this.comboEl = null;
        
        this.init();
    }

    async init() {
        const urlParams = new URLSearchParams(window.location.search);
        const themeId = urlParams.get('theme');
        
        if (!themeId) {
            this.showError('Тема не выбрана');
            return;
        }
        
        // Инициализируем DOM элементы ПОСЛЕ загрузки DOM
        this.initDOMElements();

        try {
            await this.loadTheme(themeId);
            this.setupGame();
            this.initializePools();
            this.fillBoard();
        } catch (error) {
            console.error('Ошибка инициализации игры:', error);
            this.showError('Не удалось загрузить игру');
        }
    }
    
    initDOMElements() {
        this.leftContainer = document.getElementById('left-cards');
        this.rightContainer = document.getElementById('right-cards');
        this.matchedCountEl = document.getElementById('matched-count');
        this.totalCountEl = document.getElementById('total-count');
        this.completionScreen = document.getElementById('game-completed');
        this.scoreEl = document.getElementById('score');
        this.comboEl = document.getElementById('combo');
        
        if (!this.leftContainer || !this.rightContainer) {
            console.error('Критические DOM элементы не найдены!');
        }
    }

    async loadTheme(themeId) {
        const response = await fetch(`data/themes/${themeId}.json`);
        if (!response.ok) throw new Error('Тема не найдена');
        
        this.themeData = await response.json();
        this.allPairs = [...this.themeData.pairs];
        
        // Перемешиваем пары
        this.shuffleArray(this.allPairs);
        
        console.log(`Загружено пар: ${this.allPairs.length}`);
    }

    setupGame() {
        // Обновляем заголовки
        document.getElementById('game-title').textContent = this.themeData.title;
        document.getElementById('game-description').textContent = this.themeData.description;
        document.getElementById('left-column-title').textContent = this.themeData.leftColumn.title;
        document.getElementById('right-column-title').textContent = this.themeData.rightColumn.title;
        
        // Обновляем общее количество пар
        if (this.totalCountEl) {
            this.totalCountEl.textContent = this.allPairs.length;
        }
        
        // Обработчик кнопки "Играть снова"
        const playAgainBtn = document.getElementById('play-again');
        if (playAgainBtn) {
            playAgainBtn.addEventListener('click', () => this.resetGame());
        }
        
        document.title = this.themeData.title;
    }

    // ============ ПОТОКОВАЯ МОДЕЛЬ С ПУЛАМИ ============

    initializePools() {
        // Определяем тип темы
        const isOneToMany = this.themeData.type === 'one-to-many';
        
        // Создаём левый пул
        this.leftPool = this.allPairs.map(pair => {
            const leftCard = {
                id: pair.id,
                content: pair.left,
                side: 'left',
                pairId: pair.id
            };
            
            // Если one-to-many, добавляем данные о прогрессе
            if (isOneToMany && pair.rightCards) {
                leftCard.totalMatches = pair.rightCards.length;
                leftCard.currentMatches = 0;
                leftCard.matchedRightIds = [];
            }
            
            return leftCard;
        });

        // Создаём правый пул
        this.rightPool = [];
        
        if (isOneToMany) {
            // ONE-TO-MANY: Создаём несколько правых карточек для каждой левой
            this.allPairs.forEach(pair => {
                if (pair.rightCards && Array.isArray(pair.rightCards)) {
                    pair.rightCards.forEach((rightContent, index) => {
                        this.rightPool.push({
                            id: `${pair.id}-${index}`,
                            content: rightContent,
                            side: 'right',
                            pairId: pair.id,
                            rightIndex: index
                        });
                    });
                }
            });
        } else {
            // ONE-TO-ONE: Обычная логика
            this.rightPool = this.allPairs.map(pair => ({
                id: pair.id,
                content: pair.right,
                side: 'right',
                pairId: pair.id
            }));
        }

        // Перемешиваем правый пул (чтобы не было прямого сопоставления)
        this.shuffleArray(this.rightPool);
        
        console.log('Пулы инициализированы:', {
            type: isOneToMany ? 'one-to-many' : 'one-to-one',
            leftPool: this.leftPool.length,
            rightPool: this.rightPool.length
        });
    }

    fillBoard() {
        // Заполняем доску начальными карточками
        this.leftCards = [];
        this.rightCards = [];
        
        // Берём первые 6 карточек из каждого пула
        for (let i = 0; i < this.maxCardsPerColumn && i < this.leftPool.length; i++) {
            this.leftCards.push(this.leftPool[i]);
            this.rightCards.push(this.rightPool[i]);
        }
        
        // Удаляем использованные карточки из пулов
        this.leftPool.splice(0, this.maxCardsPerColumn);
        this.rightPool.splice(0, this.maxCardsPerColumn);
        
        // КРИТИЧЕСКАЯ ПРОВЕРКА: Есть ли хотя бы одна совместимая пара?
        let attempts = 0;
        const maxAttempts = 100;
        
        while (!this.hasMatchOnBoard() && attempts < maxAttempts) {
            console.warn(`Попытка ${attempts + 1}: Нет совместимых пар, перемешиваем правую колонку`);
            this.shuffleArray(this.rightCards);
            attempts++;
        }
        
        if (attempts >= maxAttempts) {
            console.error('Не удалось создать доску с совместимыми парами за 100 попыток!');
        } else {
            console.log(`✅ Доска инициализирована с совместимой парой (попыток: ${attempts + 1})`);
        }
        
        // Отрисовываем доску
        this.renderBoard();
    }

    hasMatchOnBoard() {
        // Проверяет, есть ли хотя бы одна совместимая пара на доске
        for (const leftCard of this.leftCards) {
            for (const rightCard of this.rightCards) {
                if (leftCard.pairId === rightCard.pairId) {
                    return true;
                }
            }
        }
        return false;
    }

    renderBoard() {
        // Очищаем контейнеры
        this.leftContainer.innerHTML = '';
        this.rightContainer.innerHTML = '';
        
        // Отрисовываем левую колонку
        this.leftCards.forEach(cardData => {
            this.createCard(cardData, this.leftContainer);
        });
        
        // Отрисовываем правую колонку
        this.rightCards.forEach(cardData => {
            this.createCard(cardData, this.rightContainer);
        });
        
        // Инициализируем drag and drop
        if (window.dragDropManager) {
            window.dragDropManager.init();
        }
        
        console.log('Доска отрисована:', {
            leftCards: this.leftCards.length,
            rightCards: this.rightCards.length,
            leftPool: this.leftPool.length,
            rightPool: this.rightPool.length
        });
    }

    createCard(cardData, container, isNew = false) {
        const card = document.createElement('div');
        card.className = 'card';
        
        // Добавляем анимацию появления только для НОВЫХ карточек
        if (isNew) {
            card.classList.add('card-enter');
        }
        
        card.dataset.pairId = cardData.pairId;
        card.dataset.side = cardData.side;
        
        // Для one-to-many правых карточек используем их уникальный id
        if (cardData.side === 'right' && typeof cardData.id === 'string' && cardData.id.includes('-')) {
            card.dataset.cardId = `${cardData.side}-${cardData.id}`;
        } else {
            card.dataset.cardId = `${cardData.side}-${cardData.pairId}`;
        }
        
        card.draggable = cardData.side === 'right';
        
        const content = document.createElement('div');
        content.className = 'card-content';
        content.textContent = cardData.content;
        
        // Адаптивный размер шрифта в зависимости от длины текста
        const textLength = cardData.content.length;
        if (textLength > 80) {
            content.classList.add('text-very-long');
        } else if (textLength > 60) {
            content.classList.add('text-long');
        } else if (textLength > 40) {
            content.classList.add('text-medium');
        }
        
        card.appendChild(content);
        
        // Если это левая карточка с one-to-many, добавляем прогресс-бар
        if (cardData.side === 'left' && cardData.totalMatches !== undefined) {
            const progressContainer = document.createElement('div');
            progressContainer.className = 'progress-container';
            
            const progressBar = document.createElement('div');
            progressBar.className = 'progress-bar';
            
            const progressFill = document.createElement('div');
            progressFill.className = 'progress-fill';
            const percentage = (cardData.currentMatches / cardData.totalMatches) * 100;
            progressFill.style.width = `${percentage}%`;
            
            const progressText = document.createElement('div');
            progressText.className = 'progress-text';
            progressText.textContent = `${cardData.currentMatches}/${cardData.totalMatches}`;
            
            progressBar.appendChild(progressFill);
            progressContainer.appendChild(progressBar);
            progressContainer.appendChild(progressText);
            card.appendChild(progressContainer);
        }
        
        container.appendChild(card);
        
        return card;
    }

    // ============ ПРОВЕРКА СОВПАДЕНИЙ ============

    checkMatch(draggedCard, targetCard) {
        // ЗАЩИТА ОТ RACE CONDITIONS
        if (this.isProcessing) {
            console.warn('Обработка предыдущего совпадения, игнорируем клик');
            return false;
        }
        
        // Проверяем что карточки не удалены и не в процессе удаления
        if (!draggedCard || !targetCard || 
            draggedCard.classList.contains('matched') || 
            targetCard.classList.contains('matched') ||
            draggedCard.classList.contains('fade-out') || 
            targetCard.classList.contains('fade-out')) {
            console.warn('Попытка взаимодействия с удалённой карточкой');
            return false;
        }
        
        const draggedPairId = draggedCard.dataset.pairId;
        const targetPairId = targetCard.dataset.pairId;
        
        if (draggedPairId === targetPairId) {
            // Правильный ответ - БЛОКИРУЕМ дальнейшие действия
            this.isProcessing = true;
            
            // НЕ увеличиваем correctAnswers и combo здесь - это сделает handleMatch
            this.addScore(50);
            this.handleMatch(draggedCard, targetCard, draggedPairId);
            return true;
        } else {
            // Неправильный ответ - красная анимация
            this.incorrectAnswers++;
            this.subtractScore(10);
            this.resetCombo();
            this.showIncorrectMatch(draggedCard, targetCard);
            return false;
        }
    }
    
    showIncorrectMatch(card1, card2) {
        // Красная анимация для неправильного ответа
        card1.classList.add('incorrect');
        card2.classList.add('incorrect');
        
        setTimeout(() => {
            card1.classList.remove('incorrect');
            card2.classList.remove('incorrect');
        }, 600);
    }

    handleMatch(card1, card2, pairId) {
        // Определяем какая карточка левая, какая правая
        const leftCard = card1.dataset.side === 'left' ? card1 : card2;
        const rightCard = card1.dataset.side === 'right' ? card1 : card2;
        
        // Помечаем карточки как совпавшие
        leftCard.classList.add('matched');
        rightCard.classList.add('matched');
        
        // ВАЖНО: Блокируем ОБЕ карточки от drag-and-drop
        leftCard.draggable = false;
        rightCard.draggable = false;
        
        // Показываем описание пары
        this.showPairDescription(pairId);
        
        // Проверяем тип темы
        const isOneToMany = this.themeData.type === 'one-to-many';
        
        if (isOneToMany) {
            // ONE-TO-MANY логика
            this.handleOneToManyMatch(leftCard, rightCard, pairId);
        } else {
            // ONE-TO-ONE логика (обычная)
            this.handleOneToOneMatch(leftCard, rightCard, pairId);
        }
    }
    
    handleOneToOneMatch(leftCard, rightCard, pairId) {
        // Стандартная логика - удаляем обе карточки
        this.correctAnswers++;
        this.addScore(50);
        this.increaseCombo();
        
        // Добавляем в набор совпавших
        this.matchedPairs.add(parseInt(pairId));
        
        // Обновляем счётчик
        this.updateMatchCount();
        
        // Удаляем карточки и добавляем новые
        setTimeout(() => {
            this.removeMatchedPair(leftCard, rightCard);
            
            // Добавляем новые карточки после полного удаления старых
            setTimeout(() => {
                this.addNewCards(leftCard, rightCard);
                
                // РАЗБЛОКИРУЕМ обработку после завершения всех операций
                this.isProcessing = false;
            }, 450); // Синхронизировано: 400ms fadeOut + 50ms буфер
            
            // Проверяем завершение игры
            if (this.matchedPairs.size >= this.allPairs.length) {
                setTimeout(() => this.completeGame(), 500);
            }
        }, 600);
    }
    
    handleOneToManyMatch(leftCard, rightCard, pairId) {
        // Находим данные левой карточки в массиве
        const leftCardData = this.leftCards.find(c => c.pairId === parseInt(pairId));
        
        if (!leftCardData) {
            console.error('Левая карточка не найдена в leftCards');
            this.isProcessing = false;
            return;
        }
        
        // Обновляем прогресс
        leftCardData.currentMatches++;
        const rightCardId = rightCard.dataset.cardId;
        leftCardData.matchedRightIds.push(rightCardId);
        
        // Очки за каждое совпадение
        this.addScore(50);
        
        console.log(`Прогресс: ${leftCardData.currentMatches}/${leftCardData.totalMatches} для "${leftCardData.content}"`);
        
        // Проверяем, все ли правые карточки найдены
        if (leftCardData.currentMatches >= leftCardData.totalMatches) {
            // ВСЕ НАЙДЕНЫ - это считается как 1 правильный ответ!
            console.log('✅ Все произведения найдены! Удаляем левую карточку');
            
            // ТОЛЬКО ЗДЕСЬ увеличиваем правильные ответы и комбо
            this.correctAnswers++;
            this.increaseCombo();
            
            // Добавляем в набор совпавших
            this.matchedPairs.add(parseInt(pairId));
            this.updateMatchCount();
            
            setTimeout(() => {
                this.removeMatchedPair(leftCard, rightCard);
                
                setTimeout(() => {
                    this.addNewCards(leftCard, rightCard);
                    this.isProcessing = false;
                }, 450); // Синхронизировано: 400ms fadeOut + 50ms буфер
                
                // Проверяем завершение игры
                if (this.matchedPairs.size >= this.allPairs.length) {
                    setTimeout(() => this.completeGame(), 500);
                }
            }, 600);
        } else {
            // ЕЩЁ НЕ ВСЕ - удаляем только правую, обновляем прогресс левой
            // НЕ увеличиваем correctAnswers и НЕ сбрасываем combo!
            console.log('⏳ Ещё осталось найти произведения');
            
            setTimeout(() => {
                // Удаляем только правую карточку
                this.removeSingleCard(rightCard, 'right');
                
                // Обновляем прогресс-бар на левой карточке
                this.updateProgressBar(leftCard, leftCardData);
                
                setTimeout(() => {
                    // Добавляем только новую правую карточку
                    this.addSmartRightCard();
                    this.isProcessing = false;
                }, 450); // Синхронизировано: 400ms fadeOut + 50ms буфер
            }, 600);
        }
    }
    
    updateProgressBar(leftCard, leftCardData) {
        const progressFill = leftCard.querySelector('.progress-fill');
        const progressText = leftCard.querySelector('.progress-text');
        
        if (progressFill && progressText) {
            const percentage = (leftCardData.currentMatches / leftCardData.totalMatches) * 100;
            progressFill.style.width = `${percentage}%`;
            progressText.textContent = `${leftCardData.currentMatches}/${leftCardData.totalMatches}`;
            
            // Анимация обновления
            progressFill.style.transition = 'width 0.3s ease';
        }
        
        // Убираем класс matched с левой карточки (она остаётся)
        leftCard.classList.remove('matched');
        leftCard.draggable = false; // но остаётся неперетаскиваемой
    }
    
    removeSingleCard(card, side) {
        if (!card) {
            console.error('Карточка не найдена для удаления');
            return;
        }
        
        card.classList.add('fade-out');
        
        // Удаляем ПОСЛЕ завершения анимации fadeOut (0.4s)
        setTimeout(() => {
            try {
                const cardId = card.dataset.cardId;
                
                // Удаляем из массива
                if (side === 'right') {
                    this.rightCards = this.rightCards.filter(c => `${c.side}-${c.id}` !== cardId);
                }
                
                // Удаляем из DOM
                if (card && card.parentNode) {
                    card.parentNode.removeChild(card);
                    console.log(`${side === 'right' ? 'Правая' : 'Левая'} карточка удалена`);
                }
            } catch (error) {
                console.error('Ошибка при удалении карточки:', error);
            }
        }, 400); // Синхронизировано с fadeOut animation (0.4s)
    }

    removeMatchedPair(leftCard, rightCard) {
        if (!leftCard || !rightCard) {
            console.error('Карточки не найдены для удаления');
            return;
        }
        
        // Добавляем класс для анимации исчезновения
        leftCard.classList.add('fade-out');
        rightCard.classList.add('fade-out');
        
        console.log('Удаление пары:', leftCard.textContent, rightCard.textContent);
        
        // Удаляем карточки после анимации
        setTimeout(() => {
            try {
                // Удаляем из массивов
                const leftCardId = leftCard.dataset.cardId;
                const rightCardId = rightCard.dataset.cardId;
                
                this.leftCards = this.leftCards.filter(c => `${c.side}-${c.pairId}` !== leftCardId);
                this.rightCards = this.rightCards.filter(c => `${c.side}-${c.pairId}` !== rightCardId);
                
                // Удаляем из DOM
                if (leftCard && leftCard.parentNode) {
                    leftCard.parentNode.removeChild(leftCard);
                    console.log('Левая карточка удалена');
                }
                if (rightCard && rightCard.parentNode) {
                    rightCard.parentNode.removeChild(rightCard);
                    console.log('Правая карточка удалена');
                }
            } catch (error) {
                console.error('Ошибка при удалении карточек:', error);
            }
        }, 400); // Синхронизировано с fadeOut animation (0.4s)
    }

    addNewCards(removedLeftCard, removedRightCard) {
        // Проверяем, есть ли карточки в пулах
        if (this.leftPool.length === 0 && this.rightPool.length === 0) {
            console.log('Пулы пусты, новые карточки не добавляются');
            return;
        }
        
        // Добавляем новую левую карточку (если есть в пуле)
        if (this.leftPool.length > 0) {
            const newLeftCard = this.leftPool.shift();
            this.leftCards.push(newLeftCard);
            
            // Создаем с анимацией появления (isNew=true)
            this.createCard(newLeftCard, this.leftContainer, true);
            
            console.log('➕ Добавлена левая карточка:', newLeftCard.content);
        }
        
        // УМНОЕ ДОБАВЛЕНИЕ правой карточки
        this.addSmartRightCard();
        
        // Реинициализируем drag and drop для новых карточек
        if (window.dragDropManager) {
            window.dragDropManager.init();
        }
    }

    addSmartRightCard() {
        if (this.rightPool.length === 0) {
            console.log('Правый пул пуст');
            return;
        }
        
        // Проверяем, есть ли совместимая пара на доске (БЕЗ учёта новой карточки)
        const hasPairWithoutNew = this.hasMatchOnBoard();
        
        let newRightCard;
        
        if (hasPairWithoutNew) {
            // Если есть пара - берём любую карточку из пула
            newRightCard = this.rightPool.shift();
            console.log('✅ Есть пара на доске, добавляем случайную карточку:', newRightCard.content);
        } else {
            // Если НЕТ пары - ищем карточку, которая создаст пару
            console.warn('⚠️ Нет пары на доске, ищем совместимую карточку');
            
            const compatibleCardIndex = this.rightPool.findIndex(card => 
                this.leftCards.some(leftCard => leftCard.pairId === card.pairId)
            );
            
            if (compatibleCardIndex !== -1) {
                // Нашли совместимую карточку
                newRightCard = this.rightPool.splice(compatibleCardIndex, 1)[0];
                console.log('✅ Нашли совместимую карточку:', newRightCard.content);
            } else {
                // Не нашли - берём любую (крайний случай)
                newRightCard = this.rightPool.shift();
                console.warn('⚠️ Не нашли совместимую, берём случайную:', newRightCard.content);
            }
        }
        
        // Добавляем карточку на доску с анимацией появления (isNew=true)
        this.rightCards.push(newRightCard);
        this.createCard(newRightCard, this.rightContainer, true);
        
        // Реинициализируем drag and drop
        if (window.dragDropManager) {
            window.dragDropManager.init();
        }
        
        console.log('Новая карточка добавлена:', {
            leftCards: this.leftCards.length,
            rightCards: this.rightCards.length,
            leftPool: this.leftPool.length,
            rightPool: this.rightPool.length,
            hasMatch: this.hasMatchOnBoard()
        });
    }

    showPairDescription(pairId) {
        const pair = this.allPairs.find(p => p.id === parseInt(pairId));
        if (!pair || !pair.description) return;
        
        this.showToast(pair.description);
    }

    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `
            <span class="toast-icon">✓</span>
            <span class="toast-message">${message}</span>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 100);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // ============ СИСТЕМА ОЧКОВ ============

    addScore(points) {
        this.score += points;
        this.updateScoreDisplay();
        this.showScorePopup(points, true); // +очки
    }

    subtractScore(points) {
        this.score = Math.max(0, this.score - points);
        this.updateScoreDisplay();
        this.showScorePopup(points, false); // -очки
    }
    
    showScorePopup(points, isPositive) {
        // Создаём всплывающее окошко около счета
        const scoreDisplay = document.querySelector('.score-display');
        if (!scoreDisplay) return;
        
        const popup = document.createElement('div');
        popup.className = `score-popup ${isPositive ? 'positive' : 'negative'}`;
        popup.textContent = `${isPositive ? '+' : '-'}${points}`;
        
        scoreDisplay.appendChild(popup);
        
        // Удаляем через 2 секунды
        setTimeout(() => {
            popup.classList.add('fade-out');
            setTimeout(() => {
                if (popup.parentNode) {
                    popup.parentNode.removeChild(popup);
                }
            }, 300);
        }, 2000);
    }

    increaseCombo() {
        this.combo++;
        if (this.combo > this.maxCombo) {
            this.maxCombo = this.combo;
        }
        
        if (this.combo >= 3) {
            const comboBonus = this.calculateComboBonus();
            this.addScore(comboBonus);
            this.showComboBonus(comboBonus);
        }
        
        this.updateComboDisplay();
    }

    resetCombo() {
        this.combo = 0;
        this.updateComboDisplay();
    }

    calculateComboBonus() {
        if (this.combo === 3) return 10;
        if (this.combo === 4) return 15;
        if (this.combo === 5) return 20;
        return 25;
    }

    updateScoreDisplay() {
        if (this.scoreEl) {
            this.scoreEl.textContent = this.score;
        }
    }

    updateComboDisplay() {
        if (!this.comboEl) return;
        
        const comboDisplay = document.getElementById('combo-display');
        
        if (this.combo >= 3) {
            comboDisplay.classList.remove('inactive');
            comboDisplay.classList.add('active');
            this.comboEl.textContent = `×${this.combo}`;
        } else {
            comboDisplay.classList.remove('active');
            comboDisplay.classList.add('inactive');
        }
    }

    showComboBonus(bonus) {
        const comboToast = document.createElement('div');
        comboToast.className = 'combo-toast';
        comboToast.innerHTML = `<div class="combo-toast-content">🔥 Комбо ×${this.combo}! +${bonus} очков!</div>`;
        document.body.appendChild(comboToast);
        
        setTimeout(() => comboToast.classList.add('show'), 100);
        setTimeout(() => {
            comboToast.classList.remove('show');
            setTimeout(() => comboToast.remove(), 300);
        }, 2000);
    }

    updateMatchCount() {
        if (this.matchedCountEl) {
            this.matchedCountEl.textContent = this.matchedPairs.size;
        }
    }

    // ============ ЗАВЕРШЕНИЕ И СБРОС ============

    completeGame() {
        if (this.completionScreen) {
            this.completionScreen.classList.remove('hidden');
            this.updateCompletionStats();
        }
    }

    updateCompletionStats() {
        const existingStats = document.querySelector('.completion-stats');
        if (existingStats) {
            existingStats.remove();
        }
        
        const accuracy = this.correctAnswers / (this.correctAnswers + this.incorrectAnswers) * 100 || 100;
        
        const statsHTML = `
            <div class="completion-stats">
                <div class="stat-item">
                    <div class="stat-label">Финальный счёт</div>
                    <div class="stat-value">${this.score}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Правильных ответов</div>
                    <div class="stat-value">${this.correctAnswers}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Точность</div>
                    <div class="stat-value">${accuracy.toFixed(0)}%</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Максимальное комбо</div>
                    <div class="stat-value">×${this.maxCombo}</div>
                </div>
            </div>
        `;
        
        const completionCard = document.querySelector('.completion-card');
        const completionMessage = completionCard.querySelector('p');
        completionMessage.insertAdjacentHTML('afterend', statsHTML);
    }

    resetGame() {
        // Сбрасываем состояние
        this.matchedPairs.clear();
        this.leftCards = [];
        this.rightCards = [];
        this.leftPool = [];
        this.rightPool = [];
        
        // ВАЖНО: Сбрасываем флаг обработки
        this.isProcessing = false;
        
        // Сбрасываем очки и комбо
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.correctAnswers = 0;
        this.incorrectAnswers = 0;
        this.updateScoreDisplay();
        this.updateComboDisplay();
        
        // ВАЖНО: Очищаем состояние drag-drop менеджера
        if (window.dragDropManager) {
            window.dragDropManager.reset();
        }
        
        // Перемешиваем пары заново
        this.shuffleArray(this.allPairs);
        
        // Скрываем экран завершения
        if (this.completionScreen) {
            this.completionScreen.classList.add('hidden');
        }
        
        // Обновляем счётчик
        this.updateMatchCount();
        
        // Переинициализируем игру
        this.initializePools();
        this.fillBoard();
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    showError(message) {
        const gameBoard = document.getElementById('game-board');
        if (gameBoard) {
            gameBoard.innerHTML = `
                <div style="text-align: center; padding: 3rem;">
                    <h2 style="color: var(--text-secondary);">${message}</h2>
                    <a href="index.html" style="color: var(--accent-color);">
                        Вернуться к выбору темы
                    </a>
                </div>
            `;
        }
    }
}

// Инициализация при загрузке страницы
window.addEventListener('DOMContentLoaded', () => {
    window.gameEngine = new GameEngine();
});
