/**
 * Менеджер взаимодействия с карточками
 * Поддерживает: клики, drag-and-drop (desktop), touch (mobile)
 */

class DragDropManager {
    constructor(gameEngine) {
        this.gameEngine = gameEngine;
        this.selectedCard = null; // Выбранная карточка (для кликов)
        this.draggedElement = null;
        this.touchClone = null;
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
        
        // Mobile touch
        card.addEventListener('touchstart', (e) => this.handleTouchStart(e, card), { passive: false });
        card.addEventListener('touchmove', (e) => this.handleTouchMove(e, card), { passive: false });
        card.addEventListener('touchend', (e) => this.handleTouchEnd(e, card));
    }

    addLeftCardListeners(card) {
        // Клик для выбора/сопоставления карточки
        card.addEventListener('click', (e) => this.handleCardClick(e, card));
        
        // Desktop drop
        card.addEventListener('dragover', (e) => this.handleDragOver(e, card));
        card.addEventListener('dragleave', (e) => this.handleDragLeave(e, card));
        card.addEventListener('drop', (e) => this.handleDrop(e, card));
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
        
        // ЗАЩИТА: Нельзя действовать во время обработки
        if (this.gameEngine.isProcessing) {
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
            return;
        }
        
        // Если выбрана карточка из той же колонки - переключаем выбор
        const selectedSide = this.selectedCard.dataset.side;
        if (selectedSide === cardSide) {
            this.deselectCard();
            this.selectedCard = card;
            card.classList.add('selected');
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
        
        // Проверяем совпадение
        const isMatch = this.gameEngine.checkMatch(rightCard, leftCard);
        
        if (!isMatch) {
            // Анимация неправильного ответа
            this.showIncorrectAnimation(this.selectedCard);
            this.showIncorrectAnimation(card);
        }
        
        // Снимаем выбор
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
        
        // Проверяем совпадение
        if (this.draggedElement && this.gameEngine) {
            const isMatch = this.gameEngine.checkMatch(this.draggedElement, card);
            
            if (!isMatch) {
                this.showIncorrectAnimation(this.draggedElement);
                this.showIncorrectAnimation(card);
            }
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
        
        if (dropTarget && this.draggedElement && this.gameEngine) {
            const isMatch = this.gameEngine.checkMatch(this.draggedElement, dropTarget);
            
            if (!isMatch) {
                this.showIncorrectAnimation(this.draggedElement);
                this.showIncorrectAnimation(dropTarget);
            }
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
`;

// Добавляем стили на страницу
if (!document.getElementById('dragdrop-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'dragdrop-styles';
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
}

// Инициализация после загрузки игрового движка
document.addEventListener('DOMContentLoaded', () => {
    const checkEngine = setInterval(() => {
        if (window.gameEngine) {
            window.dragDropManager = new DragDropManager(window.gameEngine);
            clearInterval(checkEngine);
        }
    }, 100);
});
