/**
 * Менеджер взаимодействия с карточками
 * Поддерживает: клики, drag-and-drop (desktop), touch (mobile), long press tooltip
 * 
 * ОБНОВЛЕНО для MVC архитектуры
 */

class DragDropManager {
    constructor(gameController) {
        this.gameController = gameController;
        this.selectedCard = null; // Выбранная карточка (для кликов)
        this.draggedElement = null;
        this.touchClone = null;
        
        // Long press для показа полного текста
        this.longPressTimer = null;
        this.longPressTimeout = 500; // 500ms для long press
        this.isLongPressActive = false;
        this.currentTooltip = null;
        this.touchStartPos = { x: 0, y: 0 };
        this.hasMoved = false;
    }

    init() {
        // Добавляем обработчики для всех карточек
        const cards = document.querySelectorAll('.card');
        cards.forEach(card => {
            // Убираем старые обработчики через cloneNode
            const newCard = card.cloneNode(true);
            card.parentNode.replaceChild(newCard, card);
            
            // ВАЖНО: Привязываем обработчики к newCard, а не к старому card!
            if (newCard.dataset.side === 'right' && !newCard.classList.contains('matched')) {
                this.addRightCardListeners(newCard);
            }
            
            if (newCard.dataset.side === 'left' && !newCard.classList.contains('matched')) {
                this.addLeftCardListeners(newCard);
            }
        });
    }

    addRightCardListeners(card) {
        // Клик для выбора карточки
        card.addEventListener('click', (e) => this.handleCardClick(e, card));
        
        // Desktop drag
        card.addEventListener('dragstart', (e) => this.handleDragStart(e, card));
        card.addEventListener('dragend', (e) => this.handleDragEnd(e, card));
        
        // Mobile touch (с поддержкой long press)
        card.addEventListener('touchstart', (e) => {
            // Запускаем long press таймер
            if (e.touches.length === 1) {
                this.startLongPress(card, e.touches[0]);
            }
            this.handleTouchStart(e, card);
        }, { passive: false });
        
        card.addEventListener('touchmove', (e) => {
            // Проверяем не двигается ли палец (для long press)
            if (e.touches.length === 1) {
                this.checkTouchMovement(e.touches[0]);
            }
            this.handleTouchMove(e, card);
        }, { passive: false });
        
        card.addEventListener('touchend', (e) => {
            // Отменяем long press и скрываем tooltip
            this.cancelLongPress();
            this.hideFullTextTooltip();
            this.handleTouchEnd(e, card);
        });
    }

    addLeftCardListeners(card) {
        // Клик для выбора/сопоставления карточки
        card.addEventListener('click', (e) => this.handleCardClick(e, card));
        
        // Desktop drop
        card.addEventListener('dragover', (e) => this.handleDragOver(e, card));
        card.addEventListener('dragleave', (e) => this.handleDragLeave(e, card));
        card.addEventListener('drop', (e) => this.handleDrop(e, card));
        
        // Mobile touch для long press (левые карточки не draggable, но нужен long press)
        card.addEventListener('touchstart', (e) => {
            // Запускаем long press таймер
            if (e.touches.length === 1) {
                this.startLongPress(card, e.touches[0]);
            }
        }, { passive: false });
        
        card.addEventListener('touchmove', (e) => {
            // Проверяем не двигается ли палец
            if (e.touches.length === 1) {
                this.checkTouchMovement(e.touches[0]);
            }
        }, { passive: false });
        
        card.addEventListener('touchend', (e) => {
            // Отменяем long press и скрываем tooltip
            this.cancelLongPress();
            this.hideFullTextTooltip();
        });
    }

    // ============ МЕХАНИКА КЛИКОВ ============

    handleCardClick(e, card) {
        e.preventDefault();
        e.stopPropagation();
        
        // ЗАЩИТА: Нельзя кликать на matched или удаляющиеся карточки
        if (card.classList.contains('matched') || 
            card.classList.contains('fade-out')) {
            console.warn('Попытка клика на удалённую карточку');
            return;
        }
        
        // ЗАЩИТА: Нельзя действовать во время обработки (через модель)
        if (this.gameController.model.isProcessing()) {
            console.warn('Обработка в процессе, игнорируем клик');
            return;
        }
        
        const cardSide = card.dataset.side;
        
        // Если карточка уже выбрана - снимаем выбор
        if (this.selectedCard === card) {
            this.deselectCard();
            return;
        }
        
        // Если нет выбранной карточки - выбираем эту
        if (!this.selectedCard) {
            this.selectedCard = card;
            card.classList.add('selected');
            
            // 🔊 Звук клика
            if (window.soundManager) {
                window.soundManager.playClick();
            }
            
            return;
        }
        
        // Если выбрана карточка из той же колонки - переключаем выбор
        const selectedSide = this.selectedCard.dataset.side;
        if (selectedSide === cardSide) {
            this.deselectCard();
            this.selectedCard = card;
            card.classList.add('selected');
            
            // 🔊 Звук клика
            if (window.soundManager) {
                window.soundManager.playClick();
            }
            
            return;
        }
        
        // Если выбрана карточка из другой колонки - проверяем совпадение
        // Определяем какая левая, какая правая
        let leftCard, rightCard;
        if (cardSide === 'left') {
            leftCard = card;
            rightCard = this.selectedCard;
        } else {
            leftCard = this.selectedCard;
            rightCard = card;
        }
        
        // Проверяем совпадение через контроллер
        // Сначала устанавливаем draggedCardId (правая карточка)
        this.gameController.handleCardDragStart(rightCard.dataset.cardId);
        // Затем делаем drop на левую
        this.gameController.handleCardDrop(leftCard.dataset.cardId);
        
        // Снимаем выделение
        this.deselectCard();
    }

    deselectCard() {
        if (this.selectedCard) {
            this.selectedCard.classList.remove('selected');
            this.selectedCard = null;
        }
    }

    // ============ DESKTOP DRAG & DROP ============

    handleDragStart(e, card) {
        // Уведомляем контроллер о начале перетаскивания
        if (!this.gameController.handleCardDragStart(card.dataset.cardId)) {
            e.preventDefault();
            return;
        }
        
        this.draggedElement = card;
        card.classList.add('dragging');
        
        // Устанавливаем данные для переноса
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', card.dataset.pairId);
        
        // Снимаем выбор при начале перетаскивания
        this.deselectCard();
    }

    handleDragEnd(e, card) {
        card.classList.remove('dragging');
        
        // Убираем подсветку со всех drop-зон
        document.querySelectorAll('.drop-target').forEach(target => {
            target.classList.remove('drop-target');
        });
        
        this.draggedElement = null;
    }

    handleDragOver(e, card) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        // Подсвечиваем drop-зону
        if (!card.classList.contains('matched')) {
            card.classList.add('drop-target');
        }
    }

    handleDragLeave(e, card) {
        card.classList.remove('drop-target');
    }

    handleDrop(e, card) {
        e.preventDefault();
        e.stopPropagation();
        
        card.classList.remove('drop-target');
        
        // Проверяем совпадение через контроллер
        if (this.draggedElement && this.gameController) {
            this.gameController.handleCardDrop(card.dataset.cardId);
        }
    }

    // ============ MOBILE TOUCH ============

    handleTouchStart(e, card) {
        // Если карточка уже выбрана кликом, не создаём touch clone
        if (this.selectedCard === card) {
            return;
        }
        
        e.preventDefault();
        
        this.draggedElement = card;
        const touch = e.touches[0];
        
        // Создаём визуальный клон для перетаскивания
        this.createTouchClone(card, touch.clientX, touch.clientY);
        
        // Делаем оригинал полупрозрачным
        card.style.opacity = '0.4';
    }

    handleTouchMove(e, card) {
        if (!this.touchClone) return;
        
        e.preventDefault();
        
        const touch = e.touches[0];
        
        // Двигаем клон за пальцем
        this.touchClone.style.left = touch.clientX - this.touchClone.offsetWidth / 2 + 'px';
        this.touchClone.style.top = touch.clientY - this.touchClone.offsetHeight / 2 + 'px';
        
        // Подсвечиваем drop-зону под пальцем
        this.highlightDropTarget(touch.clientX, touch.clientY);
    }

    handleTouchEnd(e, card) {
        if (this.draggedElement) {
            this.draggedElement.style.opacity = '1';
        }
        
        // Удаляем клон
        if (this.touchClone) {
            this.touchClone.remove();
            this.touchClone = null;
        }
        
        // Убираем подсветку
        document.querySelectorAll('.drop-target').forEach(target => {
            target.classList.remove('drop-target');
        });
        
        // Проверяем drop
        const touch = e.changedTouches[0];
        const dropTarget = this.findDropTarget(touch.clientX, touch.clientY);
        
        if (dropTarget && this.draggedElement && this.gameController) {
            this.gameController.handleCardDrop(dropTarget.dataset.cardId);
        }
        
        this.draggedElement = null;
    }

    createTouchClone(element, x, y) {
        this.touchClone = element.cloneNode(true);
        this.touchClone.classList.add('touch-clone');
        this.touchClone.style.position = 'fixed';
        this.touchClone.style.left = x - element.offsetWidth / 2 + 'px';
        this.touchClone.style.top = y - element.offsetHeight / 2 + 'px';
        this.touchClone.style.width = element.offsetWidth + 'px';
        this.touchClone.style.opacity = '0.9';
        this.touchClone.style.pointerEvents = 'none';
        this.touchClone.style.zIndex = '1000';
        this.touchClone.style.transform = 'rotate(3deg) scale(1.05)';
        
        document.body.appendChild(this.touchClone);
    }

    highlightDropTarget(x, y) {
        // Убираем старую подсветку
        document.querySelectorAll('.drop-target').forEach(target => {
            target.classList.remove('drop-target');
        });
        
        // Находим новую цель
        const target = this.findDropTarget(x, y);
        if (target && !target.classList.contains('matched')) {
            target.classList.add('drop-target');
        }
    }

    findDropTarget(x, y) {
        // Временно скрываем клон
        if (this.touchClone) {
            this.touchClone.style.display = 'none';
        }
        
        const element = document.elementFromPoint(x, y);
        
        if (this.touchClone) {
            this.touchClone.style.display = 'block';
        }
        
        // Ищем ближайшую левую карточку
        return element?.closest('.card[data-side="left"]:not(.matched)');
    }

    // ============ АНИМАЦИИ ============

    showIncorrectAnimation(element) {
        element.classList.add('shake');
        setTimeout(() => {
            element.classList.remove('shake');
        }, 500);
    }
    
    // ВАЖНО: Метод для очистки состояния при resetGame
    reset() {
        // Очищаем выбранную карточку
        if (this.selectedCard) {
            this.selectedCard.classList.remove('selected');
            this.selectedCard = null;
        }
        
        // Очищаем drag состояние
        this.draggedElement = null;
        
        // Удаляем touch clone если он существует
        if (this.touchClone && this.touchClone.parentNode) {
            this.touchClone.parentNode.removeChild(this.touchClone);
            this.touchClone = null;
        }
        
        console.log('DragDropManager состояние очищено');
    }
    
    /**
     * ═══════════════════════════════════════════════════════════════
     * LONG PRESS TOOLTIP - ПОКАЗ ПОЛНОГО ТЕКСТА
     * ═══════════════════════════════════════════════════════════════
     * 
     * Когда пользователь зажимает карточку на 500ms,
     * появляется tooltip с полным текстом карточки.
     * 
     * Зачем?
     * На мобильных карточки обрезаются: "Александр Серге..."
     * Long press позволяет увидеть полный текст без перехода в модалку
     */
    
    /**
     * Запуск таймера long press
     */
    startLongPress(card, touch) {
        // Сохраняем начальную позицию касания
        this.touchStartPos = {
            x: touch.clientX,
            y: touch.clientY
        };
        this.hasMoved = false;
        
        // Запускаем таймер на 500ms
        this.longPressTimer = setTimeout(() => {
            // Если палец не двигался - показываем tooltip
            if (!this.hasMoved) {
                this.showFullTextTooltip(card);
            }
        }, this.longPressTimeout);
    }
    
    /**
     * Отмена long press (палец двинулся или отпущен)
     */
    cancelLongPress() {
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
        
        this.isLongPressActive = false;
    }
    
    /**
     * Проверка движения пальца
     */
    checkTouchMovement(touch) {
        const deltaX = Math.abs(touch.clientX - this.touchStartPos.x);
        const deltaY = Math.abs(touch.clientY - this.touchStartPos.y);
        
        // Если сдвинулся больше чем на 10px - это уже не long press
        if (deltaX > 10 || deltaY > 10) {
            this.hasMoved = true;
            this.cancelLongPress();
        }
    }
    
    /**
     * Показать tooltip с полным текстом
     */
    showFullTextTooltip(card) {
        // Устанавливаем флаг что long press активен
        this.isLongPressActive = true;
        
        // Получаем полный текст из карточки
        const cardContent = card.querySelector('.card-content');
        if (!cardContent) return;
        
        const fullText = cardContent.textContent;
        
        // Создаём tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'long-press-tooltip';
        
        // Иконка
        const icon = document.createElement('div');
        icon.className = 'tooltip-icon';
        icon.textContent = '📝';
        
        // Текст
        const text = document.createElement('div');
        text.className = 'tooltip-text';
        text.textContent = fullText;
        
        // Hint
        const hint = document.createElement('div');
        hint.className = 'tooltip-hint';
        hint.textContent = 'Отпустите чтобы закрыть';
        
        tooltip.appendChild(icon);
        tooltip.appendChild(text);
        tooltip.appendChild(hint);
        
        // Добавляем на страницу
        document.body.appendChild(tooltip);
        
        // Сохраняем ссылку
        this.currentTooltip = tooltip;
        
        // Плавное появление
        requestAnimationFrame(() => {
            tooltip.classList.add('show');
        });
        
        // Вибрация для тактильной обратной связи (если поддерживается)
        if (navigator.vibrate) {
            navigator.vibrate(50); // Короткая вибрация
        }
        
        console.log('✅ Long press tooltip показан:', fullText);
    }
    
    /**
     * Скрыть tooltip
     */
    hideFullTextTooltip() {
        if (this.currentTooltip) {
            // Плавное исчезновение
            this.currentTooltip.classList.remove('show');
            
            // Удаляем из DOM через 300ms (длительность анимации)
            setTimeout(() => {
                if (this.currentTooltip && this.currentTooltip.parentNode) {
                    this.currentTooltip.parentNode.removeChild(this.currentTooltip);
                }
                this.currentTooltip = null;
            }, 300);
        }
        
        this.isLongPressActive = false;
        console.log('❌ Long press tooltip скрыт');
    }
}

// Добавляем CSS для анимаций
const styles = `
/* Выбранная карточка */
.card.selected {
    border-color: var(--accent-color) !important;
    border-width: 2px !important;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2) !important;
    transform: translateY(-2px) !important;
}

/* Анимация встряхивания */
.card.shake {
    animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97);
}

@keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
    20%, 40%, 60%, 80% { transform: translateX(8px); }
}

/* Touch clone */
.touch-clone {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3) !important;
}

/* ═══════════════════════════════════════════════════════════
   LONG PRESS TOOLTIP - ПОКАЗ ПОЛНОГО ТЕКСТА
   ═══════════════════════════════════════════════════════════
   
   Когда пользователь зажимает карточку на 500ms,
   появляется tooltip с полным текстом.
*/

.long-press-tooltip {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) scale(0.8);
    max-width: 85%;
    background: linear-gradient(135deg, var(--bg-card) 0%, var(--bg-secondary) 100%);
    border: 2px solid var(--accent-color);
    border-radius: 16px;
    padding: 1.5rem;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
    z-index: 10000;
    opacity: 0;
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    pointer-events: none;
}

.long-press-tooltip.show {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
}

.long-press-tooltip .tooltip-icon {
    font-size: 2rem;
    text-align: center;
    margin-bottom: 0.75rem;
    animation: tooltipBounce 0.5s ease;
}

@keyframes tooltipBounce {
    0% { transform: scale(0); }
    50% { transform: scale(1.2); }
    100% { transform: scale(1); }
}

.long-press-tooltip .tooltip-text {
    color: var(--text-primary);
    font-size: 1.1rem;
    line-height: 1.5;
    text-align: center;
    font-weight: 500;
    margin-bottom: 0.75rem;
    word-wrap: break-word;
}

.long-press-tooltip .tooltip-hint {
    color: var(--text-secondary);
    font-size: 0.85rem;
    text-align: center;
    font-style: italic;
    opacity: 0.8;
}

/* Затемнение фона при показе tooltip */
.long-press-tooltip::before {
    content: '';
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: -1;
    opacity: 0;
    transition: opacity 0.3s ease;
}

.long-press-tooltip.show::before {
    opacity: 1;
}

/* Адаптация для мобильных */
@media (max-width: 768px) {
    .long-press-tooltip {
        max-width: 90%;
        padding: 1.25rem;
    }
    
    .long-press-tooltip .tooltip-icon {
        font-size: 1.75rem;
        margin-bottom: 0.5rem;
    }
    
    .long-press-tooltip .tooltip-text {
        font-size: 1rem;
        margin-bottom: 0.5rem;
    }
    
    .long-press-tooltip .tooltip-hint {
        font-size: 0.75rem;
    }
}

/* Очень маленькие экраны */
@media (max-width: 374px) {
    .long-press-tooltip {
        padding: 1rem;
    }
    
    .long-press-tooltip .tooltip-text {
        font-size: 0.9rem;
    }
}
`;

// Добавляем стили на страницу
if (!document.getElementById('dragdrop-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'dragdrop-styles';
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
}

// Инициализация после загрузки контроллера
document.addEventListener('DOMContentLoaded', () => {
    const checkController = setInterval(() => {
        if (window.gameController) {
            window.dragDropManager = new DragDropManager(window.gameController);
            clearInterval(checkController);
        }
    }, 100);
});
