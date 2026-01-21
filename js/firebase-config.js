/**
 * ═══════════════════════════════════════════════════════════════════
 * FIREBASE CONFIGURATION
 * ═══════════════════════════════════════════════════════════════════
 * 
 * ВАЖНО: Замените значения ниже на ваши собственные из Firebase Console
 * 
 * Как получить конфигурацию:
 * 1. Зайдите на https://console.firebase.google.com
 * 2. Создайте проект или откройте существующий
 * 3. Перейдите в настройки проекта (⚙️)
 * 4. Прокрутите вниз до раздела "Ваши приложения"
 * 5. Нажмите кнопку "</>" (Web app)
 * 6. Скопируйте конфигурацию
 */

const firebaseConfig = {
    apiKey: "YOUR_API_KEY_HERE",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

/**
 * ═══════════════════════════════════════════════════════════════════
 * ИНСТРУКЦИИ ПО НАСТРОЙКЕ
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Шаг 1: Создайте проект Firebase
 * - Зайдите на https://console.firebase.google.com
 * - Нажмите "Добавить проект"
 * - Введите название проекта (например: "match-game")
 * - Следуйте инструкциям
 * 
 * Шаг 2: Включите Authentication
 * - В меню слева выберите "Authentication"
 * - Нажмите "Начать"
 * - Во вкладке "Sign-in method" включите "Email/Password"
 * 
 * Шаг 3: Создайте Firestore Database
 * - В меню слева выберите "Firestore Database"
 * - Нажмите "Создать базу данных"
 * - Выберите "Начать в тестовом режиме"
 * - Выберите регион (europe-west1 для Европы)
 * 
 * Шаг 4: Настройте Security Rules
 * - Перейдите во вкладку "Rules"
 * - Вставьте правила из файла firestore.rules
 * - Нажмите "Опубликовать"
 * 
 * Шаг 5: Получите конфигурацию
 * - Перейдите в Настройки проекта (⚙️)
 * - Прокрутите до "Ваши приложения"
 * - Нажмите "</>" (веб-приложение)
 * - Скопируйте конфигурацию
 * - Замените значения выше
 */

// Инициализация Firebase
try {
    firebase.initializeApp(firebaseConfig);
    console.log('✅ Firebase инициализирован');
    
    // Экспорт сервисов
    window.auth = firebase.auth();
    window.db = firebase.firestore();
    
    // Настройка persistence (сохранение сессии)
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(() => {
            console.log('✅ Persistence настроен (LOCAL)');
        })
        .catch((error) => {
            console.error('❌ Ошибка persistence:', error);
        });
    
} catch (error) {
    console.error('❌ Ошибка инициализации Firebase:', error);
    console.error('Проверьте что вы заменили конфигурацию на вашу собственную!');
}
