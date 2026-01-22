/**
 * ═══════════════════════════════════════════════════════════════════
 * PROGRESS MANAGER - Управление прогрессом игрока
 * ═══════════════════════════════════════════════════════════════════
 * 
 * MVC v4.0: Добавлено версионирование данных
 */

// Версия формата данных прогресса
const PROGRESS_DATA_VERSION = 1;

class ProgressManager {
    constructor() {
        this.userId = null;
        this.authSubscribed = false;
        
        // Пытаемся подписаться на authManager
        this.trySubscribeToAuth();
        
        console.log(`📊 ProgressManager инициализирован (версия данных: ${PROGRESS_DATA_VERSION})`);
    }
    
    /**
     * Попытка подписаться на authManager (с повторами если не готов)
     */
    trySubscribeToAuth() {
        if (window.authManager) {
            authManager.onAuthStateChanged(user => {
                this.userId = user ? user.uid : null;
                console.log('📊 ProgressManager: userId =', this.userId);
            });
            this.authSubscribed = true;
        } else {
            // authManager ещё не готов, повторим через 100мс
            console.log('⏳ ProgressManager: ждём authManager...');
            setTimeout(() => this.trySubscribeToAuth(), 100);
        }
    }
    
    /**
     * ═══════════════════════════════════════════════════════════
     * СОХРАНЕНИЕ РЕЗУЛЬТАТА ИГРЫ
     * ═══════════════════════════════════════════════════════════
     */
    
    async saveGameResult(themeId, difficulty, results) {
        if (!this.userId) {
            console.log('⚠️ Пользователь не вошёл - прогресс не сохраняется');
            return;
        }
        
        try {
            console.log('💾 Сохранение прогресса:', { themeId, difficulty, results });
            
            const progressRef = db.collection('users')
                .doc(this.userId)
                .collection('progress')
                .doc(`${themeId}_${difficulty}`);
            
            // Получаем текущий прогресс
            const doc = await progressRef.get();
            const currentData = doc.exists ? doc.data() : {};
            
            // Обновляем если это лучший результат
            const updates = {
                version: PROGRESS_DATA_VERSION,  // ← Версия данных
                themeId: themeId,
                difficulty: difficulty,
                timesPlayed: (currentData.timesPlayed || 0) + 1,
                lastPlayed: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            if (!currentData.bestScore || results.score > currentData.bestScore) {
                updates.bestScore = results.score;
            }
            
            if (!currentData.bestAccuracy || results.accuracy > currentData.bestAccuracy) {
                updates.bestAccuracy = results.accuracy;
            }
            
            if (!currentData.bestCombo || results.combo > currentData.bestCombo) {
                updates.bestCombo = results.combo;
            }
            
            if (results.completed) {
                updates.completed = true;
                updates.completedAt = firebase.firestore.FieldValue.serverTimestamp();
            }
            
            await progressRef.set(updates, { merge: true });
            
            // Обновляем общую статистику
            await this.updateStats(results);
            
            console.log('✅ Прогресс сохранён');
            
        } catch (error) {
            console.error('❌ Ошибка сохранения прогресса:', error);
        }
    }
    
    /**
     * Обновление общей статистики
     */
    async updateStats(results) {
        const userRef = db.collection('users').doc(this.userId);
        
        await userRef.update({
            'stats.totalGames': firebase.firestore.FieldValue.increment(1),
            'stats.totalCorrect': firebase.firestore.FieldValue.increment(results.correct || 0),
            'stats.totalIncorrect': firebase.firestore.FieldValue.increment(results.incorrect || 0),
            'stats.totalCombo': firebase.firestore.FieldValue.increment(results.combo || 0),
            'stats.totalPlayTime': firebase.firestore.FieldValue.increment(results.duration || 0)
        });
    }
    
    /**
     * ═══════════════════════════════════════════════════════════
     * ПОЛУЧЕНИЕ ПРОГРЕССА
     * ═══════════════════════════════════════════════════════════
     */
    
    /**
     * Получить прогресс по теме
     * @param {string} themeId - ID темы
     * @param {number} difficulty - Сложность (опционально, если указана - вернёт только для этой сложности)
     */
    async getThemeProgress(themeId, difficulty = null) {
        if (!this.userId) return difficulty !== null ? null : {};
        
        try {
            let query = db.collection('users')
                .doc(this.userId)
                .collection('progress')
                .where('themeId', '==', themeId);
            
            // Если указана конкретная сложность
            if (difficulty !== null) {
                const docId = `${themeId}_${difficulty}`;
                const doc = await db.collection('users')
                    .doc(this.userId)
                    .collection('progress')
                    .doc(docId)
                    .get();
                
                if (!doc.exists) return null;
                
                const data = doc.data();
                
                // Проверка версии данных
                if (!data.version || data.version < PROGRESS_DATA_VERSION) {
                    console.warn(`⚠️ Старая версия прогресса (${data.version}), ожидается ${PROGRESS_DATA_VERSION}`);
                    // В будущем здесь можно добавить миграцию
                }
                
                return data;
            }
            
            // Иначе возвращаем все сложности
            const snapshot = await query.get();
            
            const progress = {};
            snapshot.forEach(doc => {
                const data = doc.data();
                progress[data.difficulty] = data;
            });
            
            return progress;
            
        } catch (error) {
            console.error('❌ Ошибка получения прогресса:', error);
            return difficulty !== null ? null : {};
        }
    }
    
    async getAllProgress() {
        if (!this.userId) return [];
        
        try {
            const snapshot = await db.collection('users')
                .doc(this.userId)
                .collection('progress')
                .get();
            
            const progress = [];
            snapshot.forEach(doc => {
                progress.push(doc.data());
            });
            
            return progress;
            
        } catch (error) {
            console.error('❌ Ошибка получения прогресса:', error);
            return [];
        }
    }
    
    async getStats() {
        if (!this.userId) return null;
        
        try {
            const userDoc = await db.collection('users')
                .doc(this.userId)
                .get();
            
            return userDoc.exists ? userDoc.data().stats : null;
            
        } catch (error) {
            console.error('❌ Ошибка получения статистики:', error);
            return null;
        }
    }
}

// Создаём глобальный экземпляр после загрузки DOM
if (typeof firebase !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.progressManager = new ProgressManager();
        });
    } else {
        window.progressManager = new ProgressManager();
    }
} else {
    console.error('❌ Firebase не загружен! Убедитесь что firebase-config.js загружен перед progress.js');
}
