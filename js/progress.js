/**
 * ═══════════════════════════════════════════════════════════════════
 * PROGRESS MANAGER - Управление прогрессом игрока
 * ═══════════════════════════════════════════════════════════════════
 */

class ProgressManager {
    constructor() {
        this.userId = null;
        
        // Подписываемся на изменения аутентификации
        if (window.authManager) {
            authManager.onAuthStateChanged(user => {
                this.userId = user ? user.uid : null;
            });
        }
        
        console.log('📊 ProgressManager инициализирован');
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
    
    async getThemeProgress(themeId) {
        if (!this.userId) return {};
        
        try {
            const snapshot = await db.collection('users')
                .doc(this.userId)
                .collection('progress')
                .where('themeId', '==', themeId)
                .get();
            
            const progress = {};
            snapshot.forEach(doc => {
                const data = doc.data();
                progress[data.difficulty] = data;
            });
            
            return progress;
            
        } catch (error) {
            console.error('❌ Ошибка получения прогресса:', error);
            return {};
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

// Создаём глобальный экземпляр
window.progressManager = new ProgressManager();
