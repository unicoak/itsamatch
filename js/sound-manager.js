/**
 * ═══════════════════════════════════════════════════════════════════
 * SOUND MANAGER - Управление звуковыми эффектами
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Использует Web Audio API для генерации звуков.
 * Преимущества:
 * - Ноль дополнительных файлов (0KB)
 * - Мгновенная загрузка
 * - Работает везде
 * - Настраиваемые параметры
 */

class SoundManager {
    constructor() {
        // Настройки (загружаются из localStorage)
        this.enabled = localStorage.getItem('soundEnabled') !== 'false'; // По умолчанию вкл
        this.volume = parseFloat(localStorage.getItem('soundVolume') || '0.5'); // 0.0 - 1.0
        
        // Audio Context (создаётся лениво при первом звуке)
        this.audioContext = null;
        this.isInitialized = false;
        
        console.log('🔊 SoundManager создан:', {
            enabled: this.enabled,
            volume: this.volume
        });
    }
    
    /**
     * ═══════════════════════════════════════════════════════════════
     * ИНИЦИАЛИЗАЦИЯ AUDIO CONTEXT
     * ═══════════════════════════════════════════════════════════════
     * 
     * ВАЖНО: AudioContext нужно создавать после взаимодействия
     * пользователя (клик, тап) из-за autoplay политики браузеров.
     * 
     * Поэтому мы создаём его лениво при первом звуке.
     */
    initAudioContext() {
        if (this.isInitialized) return;
        
        try {
            // Создаём AudioContext
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.isInitialized = true;
            console.log('✅ AudioContext инициализирован');
        } catch (error) {
            console.error('❌ Не удалось создать AudioContext:', error);
            this.enabled = false;
        }
    }
    
    /**
     * ═══════════════════════════════════════════════════════════════
     * ВОСПРОИЗВЕДЕНИЕ ЗВУКОВ
     * ═══════════════════════════════════════════════════════════════
     */
    
    /**
     * Базовая функция для генерации звука
     */
    playTone(frequency, duration, type = 'sine', fadeOut = true) {
        if (!this.enabled) return;
        if (!this.isInitialized) this.initAudioContext();
        if (!this.audioContext) return;
        
        const ctx = this.audioContext;
        const now = ctx.currentTime;
        
        // Создаём oscillator (генератор звука)
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        // Настраиваем
        oscillator.type = type; // 'sine', 'square', 'triangle', 'sawtooth'
        oscillator.frequency.value = frequency;
        
        // Громкость с учётом настройки
        const vol = this.volume * 0.3; // 0.3 - максимальная громкость
        gainNode.gain.value = vol;
        
        // Плавное затухание
        if (fadeOut) {
            gainNode.gain.setValueAtTime(vol, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);
        }
        
        // Подключаем
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        // Играем
        oscillator.start(now);
        oscillator.stop(now + duration);
    }
    
    /**
     * ✅ УСПЕШНОЕ СОВПАДЕНИЕ
     * Приятный восходящий тон - чувство достижения
     */
    playSuccess() {
        if (!this.enabled) return;
        if (!this.isInitialized) this.initAudioContext();
        if (!this.audioContext) return;
        
        const ctx = this.audioContext;
        const now = ctx.currentTime;
        
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        // Восходящий тон: 600Hz → 800Hz
        oscillator.frequency.setValueAtTime(600, now);
        oscillator.frequency.exponentialRampToValueAtTime(800, now + 0.15);
        
        // Плавное затухание
        const vol = this.volume * 0.3;
        gainNode.gain.setValueAtTime(vol, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        
        oscillator.start(now);
        oscillator.stop(now + 0.15);
        
        console.log('🔊 Звук: успех');
    }
    
    /**
     * ❌ НЕПРАВИЛЬНОЕ СОВПАДЕНИЕ
     * Короткий низкий гудок - ошибка
     */
    playError() {
        if (!this.enabled) return;
        if (!this.isInitialized) this.initAudioContext();
        if (!this.audioContext) return;
        
        const ctx = this.audioContext;
        const now = ctx.currentTime;
        
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        // Низкий короткий тон
        oscillator.frequency.value = 200;
        oscillator.type = 'square'; // Более резкий звук
        
        const vol = this.volume * 0.2;
        gainNode.gain.value = vol;
        
        oscillator.start(now);
        oscillator.stop(now + 0.1);
        
        console.log('🔊 Звук: ошибка');
    }
    
    /**
     * 👆 КЛИК ПО КАРТОЧКЕ
     * Короткий мягкий клик - обратная связь
     */
    playClick() {
        if (!this.enabled) return;
        if (!this.isInitialized) this.initAudioContext();
        if (!this.audioContext) return;
        
        const ctx = this.audioContext;
        const now = ctx.currentTime;
        
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        // Короткий средний тон
        oscillator.frequency.value = 400;
        
        const vol = this.volume * 0.15; // Тише чем остальные
        gainNode.gain.value = vol;
        
        oscillator.start(now);
        oscillator.stop(now + 0.05);
        
        // console.log('🔊 Звук: клик'); // Не логируем - слишком часто
    }
    
    /**
     * 🎉 ПОБЕДА (завершение игры)
     * Праздничные восходящие тона
     */
    playVictory() {
        if (!this.enabled) return;
        if (!this.isInitialized) this.initAudioContext();
        if (!this.audioContext) return;
        
        const ctx = this.audioContext;
        const now = ctx.currentTime;
        
        // Играем 3 ноты: до-ми-соль (мажорное трезвучие)
        const notes = [
            { freq: 523, time: 0 },      // До
            { freq: 659, time: 0.15 },   // Ми
            { freq: 784, time: 0.3 }     // Соль
        ];
        
        notes.forEach(note => {
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);
            
            oscillator.frequency.value = note.freq;
            
            const vol = this.volume * 0.25;
            gainNode.gain.setValueAtTime(vol, now + note.time);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + note.time + 0.2);
            
            oscillator.start(now + note.time);
            oscillator.stop(now + note.time + 0.2);
        });
        
        console.log('🔊 Звук: победа!');
    }
    
    /**
     * 🔥 КОМБО (серия успехов подряд)
     * Энергичный звук усиления
     */
    playCombo() {
        if (!this.enabled) return;
        if (!this.isInitialized) this.initAudioContext();
        if (!this.audioContext) return;
        
        const ctx = this.audioContext;
        const now = ctx.currentTime;
        
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        // Высокий тон с вибрато
        oscillator.frequency.setValueAtTime(1000, now);
        oscillator.frequency.exponentialRampToValueAtTime(1200, now + 0.2);
        
        const vol = this.volume * 0.3;
        gainNode.gain.setValueAtTime(vol, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        
        oscillator.start(now);
        oscillator.stop(now + 0.2);
        
        console.log('🔊 Звук: комбо!');
    }
    
    /**
     * ═══════════════════════════════════════════════════════════════
     * НАСТРОЙКИ
     * ═══════════════════════════════════════════════════════════════
     */
    
    /**
     * Включить/выключить звуки
     */
    toggle() {
        this.enabled = !this.enabled;
        localStorage.setItem('soundEnabled', this.enabled.toString());
        
        console.log('🔊 Звуки:', this.enabled ? 'включены' : 'выключены');
        
        // Обновляем UI если есть
        this.updateUI();
        
        // Пищим если включили
        if (this.enabled) {
            this.playClick();
        }
        
        return this.enabled;
    }
    
    /**
     * Установить громкость (0.0 - 1.0)
     */
    setVolume(value) {
        // Ограничиваем диапазон
        this.volume = Math.max(0, Math.min(1, value));
        localStorage.setItem('soundVolume', this.volume.toString());
        
        console.log('🔊 Громкость:', Math.round(this.volume * 100) + '%');
        
        return this.volume;
    }
    
    /**
     * Обновить UI элементы
     */
    updateUI() {
        // Обновляем иконку кнопки
        const toggleBtn = document.getElementById('sound-toggle');
        if (toggleBtn) {
            const icon = toggleBtn.querySelector('.sound-icon');
            if (icon) {
                icon.textContent = this.enabled ? '🔊' : '🔇';
            }
        }
        
        // Обновляем слайдер
        const volumeSlider = document.getElementById('volume-slider');
        if (volumeSlider) {
            volumeSlider.value = this.volume * 100;
            volumeSlider.disabled = !this.enabled;
        }
    }
    
    /**
     * ═══════════════════════════════════════════════════════════════
     * ИНИЦИАЛИЗАЦИЯ UI
     * ═══════════════════════════════════════════════════════════════
     */
    setupUI() {
        // Кнопка вкл/выкл
        const toggleBtn = document.getElementById('sound-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                this.toggle();
            });
        }
        
        // Слайдер громкости
        const volumeSlider = document.getElementById('volume-slider');
        if (volumeSlider) {
            volumeSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value) / 100;
                this.setVolume(value);
                
                // Пищим при изменении для обратной связи
                if (this.enabled) {
                    this.playClick();
                }
            });
        }
        
        // Устанавливаем начальные значения
        this.updateUI();
        
        console.log('✅ Sound UI инициализирован');
    }
}

// Создаём глобальный экземпляр
window.soundManager = new SoundManager();

// Инициализация UI при загрузке
document.addEventListener('DOMContentLoaded', () => {
    if (window.soundManager) {
        window.soundManager.setupUI();
    }
});
