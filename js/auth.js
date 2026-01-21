/**
 * ═══════════════════════════════════════════════════════════════════
 * AUTH MANAGER - Управление аутентификацией
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Отвечает за:
 * - Регистрацию пользователей
 * - Вход/выход
 * - Восстановление пароля
 * - Отслеживание состояния аутентификации
 * - Обновление UI
 */

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.onAuthStateChangedCallbacks = [];
        
        // Инициализация
        this.setupAuthListener();
        
        console.log('🔐 AuthManager инициализирован');
    }
    
    /**
     * ═══════════════════════════════════════════════════════════
     * ОТСЛЕЖИВАНИЕ СОСТОЯНИЯ АУТЕНТИФИКАЦИИ
     * ═══════════════════════════════════════════════════════════
     */
    
    setupAuthListener() {
        firebase.auth().onAuthStateChanged(user => {
            this.currentUser = user;
            
            if (user) {
                console.log('👤 Пользователь вошёл:', {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName
                });
            } else {
                console.log('👤 Пользователь вышел');
            }
            
            // Вызываем callback'и
            this.onAuthStateChangedCallbacks.forEach(callback => {
                callback(user);
            });
            
            // Обновляем UI
            this.updateUI(user);
        });
    }
    
    /**
     * Подписаться на изменения состояния
     */
    onAuthStateChanged(callback) {
        this.onAuthStateChangedCallbacks.push(callback);
    }
    
    /**
     * ═══════════════════════════════════════════════════════════
     * РЕГИСТРАЦИЯ
     * ═══════════════════════════════════════════════════════════
     */
    
    async register(email, password, displayName) {
        try {
            // Валидация
            if (!email || !password || !displayName) {
                throw new Error('Заполните все поля');
            }
            
            if (password.length < 6) {
                throw new Error('Пароль должен быть минимум 6 символов');
            }
            
            if (displayName.length < 2 || displayName.length > 20) {
                throw new Error('Имя должно быть от 2 до 20 символов');
            }
            
            console.log('📝 Регистрация пользователя:', email);
            
            // Создаём аккаунт
            const userCredential = await firebase.auth()
                .createUserWithEmailAndPassword(email, password);
            
            console.log('✅ Аккаунт создан:', userCredential.user.uid);
            
            // Обновляем профиль
            await userCredential.user.updateProfile({
                displayName: displayName
            });
            
            console.log('✅ Профиль обновлён');
            
            // Создаём документ пользователя в Firestore
            await this.createUserDocument(userCredential.user, displayName);
            
            console.log('✅ Документ создан');
            
            return {
                success: true,
                user: userCredential.user,
                message: 'Регистрация успешна! Добро пожаловать, ' + displayName
            };
            
        } catch (error) {
            console.error('❌ Ошибка регистрации:', error);
            
            // Перевод ошибок Firebase
            const errorMessage = this.translateFirebaseError(error);
            
            return {
                success: false,
                error: errorMessage
            };
        }
    }
    
    /**
     * Создание документа пользователя в Firestore
     */
    async createUserDocument(user, displayName) {
        const userRef = db.collection('users').doc(user.uid);
        
        await userRef.set({
            profile: {
                email: user.email,
                displayName: displayName,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            },
            stats: {
                totalGames: 0,
                totalCorrect: 0,
                totalIncorrect: 0,
                averageAccuracy: 0,
                totalPlayTime: 0,
                totalCombo: 0,
                favoriteTheme: null
            }
        });
    }
    
    /**
     * ═══════════════════════════════════════════════════════════
     * ВХОД
     * ═══════════════════════════════════════════════════════════
     */
    
    async login(email, password) {
        try {
            // Валидация
            if (!email || !password) {
                throw new Error('Введите email и пароль');
            }
            
            console.log('🔓 Попытка входа:', email);
            
            // Вход
            const userCredential = await firebase.auth()
                .signInWithEmailAndPassword(email, password);
            
            console.log('✅ Вход выполнен:', userCredential.user.uid);
            
            // Обновляем lastLogin
            await this.updateLastLogin(userCredential.user.uid);
            
            return {
                success: true,
                user: userCredential.user,
                message: 'Добро пожаловать, ' + (userCredential.user.displayName || 'Игрок') + '!'
            };
            
        } catch (error) {
            console.error('❌ Ошибка входа:', error);
            
            const errorMessage = this.translateFirebaseError(error);
            
            return {
                success: false,
                error: errorMessage
            };
        }
    }
    
    /**
     * Обновление времени последнего входа
     */
    async updateLastLogin(userId) {
        const userRef = db.collection('users').doc(userId);
        
        await userRef.update({
            'profile.lastLogin': firebase.firestore.FieldValue.serverTimestamp()
        });
    }
    
    /**
     * ═══════════════════════════════════════════════════════════
     * ВЫХОД
     * ═══════════════════════════════════════════════════════════
     */
    
    async logout() {
        try {
            console.log('🚪 Выход из аккаунта');
            
            await firebase.auth().signOut();
            
            console.log('✅ Выход выполнен');
            
            return {
                success: true,
                message: 'Вы вышли из аккаунта'
            };
            
        } catch (error) {
            console.error('❌ Ошибка выхода:', error);
            
            return {
                success: false,
                error: 'Не удалось выйти из аккаунта'
            };
        }
    }
    
    /**
     * ═══════════════════════════════════════════════════════════
     * ВОССТАНОВЛЕНИЕ ПАРОЛЯ
     * ═══════════════════════════════════════════════════════════
     */
    
    async resetPassword(email) {
        try {
            if (!email) {
                throw new Error('Введите email');
            }
            
            console.log('📧 Отправка ссылки сброса пароля:', email);
            
            await firebase.auth().sendPasswordResetEmail(email);
            
            console.log('✅ Ссылка отправлена');
            
            return {
                success: true,
                message: 'Ссылка для сброса пароля отправлена на ' + email
            };
            
        } catch (error) {
            console.error('❌ Ошибка сброса пароля:', error);
            
            const errorMessage = this.translateFirebaseError(error);
            
            return {
                success: false,
                error: errorMessage
            };
        }
    }
    
    /**
     * ═══════════════════════════════════════════════════════════
     * УТИЛИТЫ
     * ═══════════════════════════════════════════════════════════
     */
    
    /**
     * Перевод ошибок Firebase на русский
     */
    translateFirebaseError(error) {
        const errorMap = {
            'auth/email-already-in-use': 'Этот email уже используется',
            'auth/invalid-email': 'Некорректный email',
            'auth/operation-not-allowed': 'Операция не разрешена',
            'auth/weak-password': 'Слишком слабый пароль',
            'auth/user-disabled': 'Пользователь заблокирован',
            'auth/user-not-found': 'Пользователь не найден',
            'auth/wrong-password': 'Неверный пароль',
            'auth/too-many-requests': 'Слишком много попыток. Попробуйте позже',
            'auth/network-request-failed': 'Ошибка сети. Проверьте подключение',
            'auth/requires-recent-login': 'Требуется повторный вход'
        };
        
        const code = error.code;
        
        if (errorMap[code]) {
            return errorMap[code];
        }
        
        // Если ошибка не из Firebase, возвращаем её сообщение
        return error.message || 'Произошла ошибка';
    }
    
    /**
     * Проверка - вошёл ли пользователь
     */
    isLoggedIn() {
        return this.currentUser !== null;
    }
    
    /**
     * Получить текущего пользователя
     */
    getCurrentUser() {
        return this.currentUser;
    }
    
    /**
     * Получить UID текущего пользователя
     */
    getUserId() {
        return this.currentUser ? this.currentUser.uid : null;
    }
    
    /**
     * ═══════════════════════════════════════════════════════════
     * ОБНОВЛЕНИЕ UI
     * ═══════════════════════════════════════════════════════════
     */
    
    updateUI(user) {
        // Кнопка входа
        const loginBtn = document.getElementById('login-btn');
        
        // Профиль пользователя
        const userProfile = document.getElementById('user-profile');
        const userName = document.getElementById('user-name');
        
        if (user) {
            // Пользователь вошёл
            if (loginBtn) loginBtn.style.display = 'none';
            if (userProfile) userProfile.style.display = 'flex';
            if (userName) userName.textContent = user.displayName || 'Игрок';
        } else {
            // Пользователь вышел
            if (loginBtn) loginBtn.style.display = 'block';
            if (userProfile) userProfile.style.display = 'none';
        }
    }
}

// Создаём глобальный экземпляр
window.authManager = new AuthManager();
