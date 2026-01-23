/**
 * ═══════════════════════════════════════════════════════════════════
 * GAME VIEW - Отображение игры
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Принципы:
 * - Работает ТОЛЬКО с DOM
 * - НЕ содержит логику
 * - Только отображение данных из модели
 * 
 * @version 4.0
 */

class GameView {
    constructor() {
        console.log('🎨 Инициализация GameView v4.0');
        
        // DOM элементы
        this.leftContainer = document.getElementById('left-cards');
        this.rightContainer = document.getElementById('right-cards');
        this.scoreEl = document.getElementById('score');
        this.comboEl = document.getElementById('combo');
        this.matchedCountEl = document.getElementById('matched-count');
        this.totalCountEl = document.getElementById('total-count');
        this.completionScreen = document.getElementById('game-completed');
        this.gameBoard = document.getElementById('game-board');
        
        // Валидация
        this.validateElements();
    }
    
    validateElements() {
        const required = [
            ['left-cards', this.leftContainer],
            ['right-cards', this.rightContainer],
            ['score', this.scoreEl],
            ['combo', this.comboEl]
        ];
        
        const missing = [];
        required.forEach(([id, el]) => {
            if (!el) {
                console.error(`❌ Элемент #${id} не найден`);
                missing.push(id);
            }
        });
        
        if (missing.length > 0) {
            throw new Error(`Не найдены элементы: ${missing.join(', ')}`);
        }
        
        console.log('✅ Все необходимые элементы найдены');
    }
    
    /**
     * Установить информацию о теме
     */
    setGameInfo(themeData) {
        const titleEl = document.getElementById('game-title');
        const descEl = document.getElementById('game-description');
        const leftTitleEl = document.getElementById('left-column-title');
        const rightTitleEl = document.getElementById('right-column-title');
        
        if (titleEl) titleEl.textContent = themeData.title;
        if (descEl) descEl.textContent = themeData.description || '';
        if (leftTitleEl) leftTitleEl.textContent = themeData.leftColumn?.title || 'Левая колонка';
        if (rightTitleEl) rightTitleEl.textContent = themeData.rightColumn?.title || 'Правая колонка';
        
        console.log('✅ Заголовки обновлены:', themeData.title);
    }
    
    // ═══════════════════════════════════════════════════════════
    // ОТОБРАЖЕНИЕ КАРТОЧЕК
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Отобразить все карточки
     */
    renderCards(cards) {
        if (!this.leftContainer || !this.rightContainer) return;
        
        // Очищаем
        this.leftContainer.innerHTML = '';
        this.rightContainer.innerHTML = '';
        
        // Разделяем
        const leftCards = cards.filter(c => c.side === 'left');
        const rightCards = cards.filter(c => c.side === 'right');
        
        // Отображаем
        leftCards.forEach(card => {
            const el = this.createCardElement(card);
            this.leftContainer.appendChild(el);
        });
        
        rightCards.forEach(card => {
            const el = this.createCardElement(card);
            this.rightContainer.appendChild(el);
        });
        
        console.log(`🎨 Отображено: ${leftCards.length} левых, ${rightCards.length} правых`);
    }
    
    /**
     * Создать DOM элемент карточки
     */
    createCardElement(cardData) {
        const card = document.createElement('div');
        card.className = 'card';
        card.id = cardData.id;
        card.dataset.cardId = cardData.id;
        card.dataset.pairId = cardData.pairId;
        card.dataset.side = cardData.side;
        
        // Состояние
        if (cardData.state === 'matched') {
            card.classList.add('matched');
        }
        
        // Draggable - all cards
        card.draggable = true;
        
        // Контент
        const content = document.createElement('div');
        content.className = 'card-content';
        content.textContent = cardData.text;
        card.appendChild(content);
        
        // ВАЖНО: Добавляем обработчики через dragDropManager
        // Делаем это асинхронно, чтобы карточка успела добавиться в DOM
        requestAnimationFrame(() => {
            if (window.dragDropManager && cardData.state !== 'matched') {
                if (cardData.side === 'right') {
                    window.dragDropManager.addRightCardListeners(card);
                } else if (cardData.side === 'left') {
                    window.dragDropManager.addLeftCardListeners(card);
                }
            }
        });
        
        return card;
    }
    
    /**
     * Заменить карточку на новую (прямая замена без удаления)
     */
    replaceCard(oldCardId, newCardData) {
        console.log('      [VIEW] replaceCard() вызван');
        console.log('      [VIEW] Старая:', oldCardId);
        console.log('      [VIEW] Новая:', newCardData.id);
        
        const oldCard = document.getElementById(oldCardId);
        if (!oldCard) {
            console.warn(`      [VIEW] ⚠️ Старая карточка ${oldCardId} не найдена в DOM`);
            return;
        }
        
        console.log('      [VIEW] Старая карточка найдена, создаём новую...');
        
        // Создаём новую карточку
        const newCard = this.createCardElement(newCardData);
        newCard.classList.add('card-new');
        
        console.log('      [VIEW] Замена в DOM через replaceChild...');
        
        // Заменяем в DOM (сохраняет позицию автоматически!)
        oldCard.parentNode.replaceChild(newCard, oldCard);
        
        console.log('      [VIEW] ✓ replaceChild выполнен');
        
        // Убираем анимацию появления
        setTimeout(() => {
            newCard.classList.remove('card-new');
            console.log('      [VIEW] ✓ Анимация card-new удалена');
        }, 500);
        
        console.log(`      [VIEW] ✓ Замена завершена: ${oldCardId} → ${newCardData.id}`);
    }
    
    /**
     * Удалить карточку (когда пул пуст)
     */
    removeCard(cardId) {
        const card = document.getElementById(cardId);
        if (card) {
            card.remove();
            console.log(`🗑️ Удалена карточка ${cardId} (пул пуст)`);
        }
    }
    
    /**
     * Добавить новые карточки с анимацией
     * DEPRECATED: Используйте replaceCard вместо этого
     */
    addNewCards(newCards) {
        newCards.forEach(cardData => {
            const el = this.createCardElement(cardData);
            el.classList.add('card-new');
            
            const container = cardData.side === 'left' ? 
                this.leftContainer : this.rightContainer;
            
            if (container) {
                // Вставляем карточку на позицию, где была удалённая карточка
                if (cardData.insertIndex !== undefined && cardData.insertIndex < container.children.length) {
                    // Вставляем перед существующей карточкой на этой позиции
                    container.insertBefore(el, container.children[cardData.insertIndex]);
                } else {
                    // Если позиция не указана или за пределами, добавляем в конец
                    container.appendChild(el);
                }
                
                // Убираем анимацию
                setTimeout(() => el.classList.remove('card-new'), 500);
            }
        });
    }
    
    // ═══════════════════════════════════════════════════════════
    // АНИМАЦИИ
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Показать анимацию правильного ответа
     */
    showCorrectMatch(cardId1, cardId2) {
        const card1 = document.getElementById(cardId1);
        const card2 = document.getElementById(cardId2);
        
        if (!card1 || !card2) return;
        
        // Зелёная анимация
        card1.classList.add('correct');
        card2.classList.add('correct');
        
        setTimeout(() => {
            card1.classList.remove('correct');
            card2.classList.remove('correct');
            card1.classList.add('matched', 'fade-out');
            card2.classList.add('matched', 'fade-out');
        }, 600);
    }
    
    /**
     * Показать анимацию неправильного ответа
     */
    showIncorrectMatch(cardId1, cardId2) {
        const card1 = document.getElementById(cardId1);
        const card2 = document.getElementById(cardId2);
        
        if (!card1 || !card2) return;
        
        // Красная анимация
        card1.classList.add('incorrect');
        card2.classList.add('incorrect');
        
        setTimeout(() => {
            card1.classList.remove('incorrect');
            card2.classList.remove('incorrect');
        }, 600);
    }
    
    /**
     * Удалить matched карточки из DOM
     * DEPRECATED: Используйте removeCard или replaceCard
     */
    removeMatchedCards(cardIds) {
        cardIds.forEach(cardId => {
            const card = document.getElementById(cardId);
            if (card) {
                setTimeout(() => card.remove(), 1000);
            }
        });
    }
    
    /**
     * Показать описание совпавшей пары
     */
    showMatchDescription(description) {
        if (!description) return;
        
        // Создаём tooltip элемент
        const tooltip = document.createElement('div');
        tooltip.className = 'match-description-tooltip';
        tooltip.innerHTML = `
            <div class="tooltip-icon">✅</div>
            <div class="tooltip-text">${description}</div>
        `;
        
        // Добавляем на страницу
        document.body.appendChild(tooltip);
        
        // Анимация появления (slide down)
        requestAnimationFrame(() => {
            tooltip.classList.add('show');
        });
        
        // Удаляем через 3.6 секунды (0.3s slide down + 3s visible + 0.3s slide up)
        setTimeout(() => {
            tooltip.classList.remove('show');
            setTimeout(() => {
                if (tooltip.parentNode) {
                    tooltip.parentNode.removeChild(tooltip);
                }
            }, 300); // Ждём завершения анимации slide up
        }, 3300);
        
        console.log('📝 Показано описание:', description);
    }
    
    // ═══════════════════════════════════════════════════════════
    // ОБНОВЛЕНИЕ СТАТИСТИКИ
    // ═══════════════════════════════════════════════════════════
    
    updateScore(score) {
        if (this.scoreEl) {
            this.scoreEl.textContent = score;
        }
    }
    
    updateCombo(combo) {
        if (!this.comboEl) return;
        
        if (combo > 5) {
            this.comboEl.textContent = `×${combo}`;
            this.comboEl.parentElement?.classList.add('active');
            
            // Анимация
            this.comboEl.classList.add('pulse');
            setTimeout(() => this.comboEl.classList.remove('pulse'), 300);
        } else {
            this.comboEl.textContent = '';
            this.comboEl.parentElement?.classList.remove('active');
        }
    }
    
    updateProgress(matched, total) {
        if (this.matchedCountEl) {
            this.matchedCountEl.textContent = matched;
        }
        if (this.totalCountEl) {
            this.totalCountEl.textContent = total;
        }
    }
    
    // ═══════════════════════════════════════════════════════════
    // ЭКРАН ЗАВЕРШЕНИЯ
    // ═══════════════════════════════════════════════════════════
    
    showCompletionScreen(results) {
        if (!this.completionScreen) return;
        
        // Скрываем игровое поле
        if (this.gameBoard) {
            this.gameBoard.style.display = 'none';
        }
        
        // Показываем экран завершения
        this.completionScreen.classList.remove('hidden');
        
        // Обновляем статистику
        const elements = {
            'final-score': results.score,
            'final-correct': results.correct,
            'final-incorrect': results.incorrect,
            'final-accuracy': `${results.accuracy}%`,
            'final-combo': results.maxCombo,
            'final-duration': this.formatDuration(results.duration)
        };
        
        for (const [id, value] of Object.entries(elements)) {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        }
    }
    
    formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    // ═══════════════════════════════════════════════════════════
    // ЗАГРУЗКА И ОШИБКИ
    // ═══════════════════════════════════════════════════════════
    
    showLoadingScreen(message = 'Загрузка...') {
        let overlay = document.getElementById('loading-overlay');
        
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loading-overlay';
            overlay.className = 'loading-overlay';
            overlay.innerHTML = `
                <div class="loading-content">
                    <div class="loading-spinner"></div>
                    <div class="loading-message">${message}</div>
                </div>
            `;
            document.body.appendChild(overlay);
        }
        
        overlay.querySelector('.loading-message').textContent = message;
        overlay.classList.add('active');
    }
    
    hideLoadingScreen() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.remove('active');
        }
    }
    
    updateLoadingMessage(message) {
        const overlay = document.getElementById('loading-overlay');
        const messageEl = overlay?.querySelector('.loading-message');
        if (messageEl) {
            messageEl.textContent = message;
        }
    }
    
    showErrorScreen(message) {
        this.hideLoadingScreen();
        
        let errorScreen = document.getElementById('error-screen');
        
        if (!errorScreen) {
            errorScreen = document.createElement('div');
            errorScreen.id = 'error-screen';
            errorScreen.className = 'error-screen';
            errorScreen.innerHTML = `
                <div class="error-content">
                    <div class="error-icon">⚠️</div>
                    <h2 class="error-title">Ошибка загрузки</h2>
                    <p class="error-message"></p>
                    <button class="error-retry-btn" onclick="location.reload()">Попробовать снова</button>
                    <a href="index.html" class="error-back-btn">Вернуться к темам</a>
                </div>
            `;
            document.body.appendChild(errorScreen);
        }
        
        errorScreen.querySelector('.error-message').textContent = message;
        errorScreen.classList.add('active');
    }
    
    // ═══════════════════════════════════════════════════════════
    // БЛОКИРОВКА ВЗАИМОДЕЙСТВИЯ
    // ═══════════════════════════════════════════════════════════
    
    setInteractionEnabled(enabled) {
        const containers = [this.leftContainer, this.rightContainer];
        
        containers.forEach(container => {
            if (container) {
                if (enabled) {
                    container.classList.remove('disabled');
                    container.style.pointerEvents = 'auto';
                } else {
                    container.classList.add('disabled');
                    container.style.pointerEvents = 'none';
                }
            }
        });
    }
    
    // ═══════════════════════════════════════════════════════════
    // ОЧИСТКА
    // ═══════════════════════════════════════════════════════════
    
    clear() {
        if (this.leftContainer) this.leftContainer.innerHTML = '';
        if (this.rightContainer) this.rightContainer.innerHTML = '';
        
        this.updateScore(0);
        this.updateCombo(0);
        this.updateProgress(0, 0);
    }
}

// Экспорт
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameView;
}
