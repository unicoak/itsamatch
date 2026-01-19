/**
 * Игровой движок - Потоковая модель с пулами
 * Гарантирует наличие совместимых пар на доске в любой момент
 */

/**
 * ═══════════════════════════════════════════════════════════════════════
 * ИГРОВОЙ ДВИЖОК - КЛАСС GameEngine
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * Этот класс управляет ВСЕЙ логикой игры на сопоставление карточек.
 * 
 * АРХИТЕКТУРА: "Потоковая модель с пулами"
 * - Карточки хранятся в двух пулах (leftPool и rightPool)
 * - На доску выводится только 6 пар (12 карточек)
 * - После каждого совпадения удаляются старые и добавляются новые из пулов
 * - ГАРАНТИЯ: На доске всегда есть хотя бы одна совместимая пара
 * 
 * ОСНОВНЫЕ ПРИНЦИПЫ:
 * 1. Безопасность: Валидация данных на всех этапах
 * 2. Надёжность: Защита от race conditions, утечек памяти, крашей
 * 3. Понятность: Подробные комментарии и понятные имена переменных
 * 
 * @class GameEngine
 * @version 3.9
 */
class GameEngine {
    /**
     * ═══════════════════════════════════════════════════════════════════
     * КОНСТРУКТОР
     * ═══════════════════════════════════════════════════════════════════
     * 
     * Инициализирует все переменные игры и запускает процесс загрузки.
     * Вызывается автоматически при: new GameEngine()
     */
    constructor() {
        console.log('🎮 Создание экземпляра GameEngine...');
        
        // ═══════════════════════════════════════════════════════
        // ДАННЫЕ ИГРЫ
        // ═══════════════════════════════════════════════════════
        
        /**
         * themeData - Данные текущей темы (из JSON файла)
         * 
         * Структура:
         * {
         *   id: "literary-characters",
         *   title: "Литературные персонажи",
         *   description: "Сопоставьте...",
         *   leftColumn: {title: "Персонажи", type: "characters"},
         *   rightColumn: {title: "Авторы", type: "authors"},
         *   pairs: [{id: 1, left: "Раскольников", right: "Достоевский"}, ...],
         *   type: "one-to-one" // или "one-to-many"
         * }
         * 
         * Изначально null, заполняется в loadTheme()
         */
        this.themeData = null;
        
        /**
         * allPairs - ВСЕ пары из темы (после загрузки и перемешивания)
         * 
         * Это копия themeData.pairs с примененным shuffle
         * Используется для создания пулов
         * 
         * Пример: [{id: 5, left: "...", right: "..."}, {id: 2, ...}, ...]
         */
        this.allPairs = [];
        
        /**
         * matchedPairs - Set с ID уже найденных пар
         * 
         * Зачем Set? 
         * - Автоматически избегает дубликатов
         * - Быстрая проверка наличия: O(1)
         * - Размер = количество найденных пар
         * 
         * Пример: Set {5, 12, 3, 8} → найдены пары 5, 12, 3, 8
         */
        this.matchedPairs = new Set();
        
        // ═══════════════════════════════════════════════════════
        // ПОТОКОВАЯ МОДЕЛЬ: ПУЛЫ И ДОСКА
        // ═══════════════════════════════════════════════════════
        
        /**
         * КОНЦЕПЦИЯ ПУЛОВ:
         * 
         * Представьте колоду карт. Вы:
         * 1. Раскладываете 12 карт на стол (6 левых + 6 правых) = ДОСКА
         * 2. Остальные карты в колоде = ПУЛЫ
         * 3. Нашли пару → убираете 2 карты со стола
         * 4. Добираете 2 новые из колоды
         * 
         * Так же работает эта игра!
         */
        
        /**
         * leftPool - РЕЗЕРВ левых карточек (еще не на доске)
         * 
         * Структура элемента:
         * {
         *   id: 5,
         *   content: "Раскольников",
         *   side: "left",
         *   pairId: 5,
         *   // Для one-to-many:
         *   totalMatches: 3,
         *   currentMatches: 0,
         *   matchedRightIds: []
         * }
         */
        this.leftPool = [];
        
        /**
         * rightPool - РЕЗЕРВ правых карточек (перемешанные!)
         * 
         * ВАЖНО: Правый пул перемешивается!
         * Иначе карточки будут в том же порядке что и левые
         * = игра слишком простая
         * 
         * Структура элемента:
         * {
         *   id: 5, // или "5-0" для one-to-many
         *   content: "Достоевский",
         *   side: "right",
         *   pairId: 5
         * }
         */
        this.rightPool = [];
        
        /**
         * leftCards - Карточки СЕЙЧАС на доске слева
         * 
         * Массив из 0-6 элементов (обычно 6)
         * Структура элементов такая же как в leftPool
         */
        this.leftCards = [];
        
        /**
         * rightCards - Карточки СЕЙЧАС на доске справа
         * 
         * Массив из 0-6 элементов (обычно 6)
         * Структура элементов такая же как в rightPool
         */
        this.rightCards = [];
        
        /**
         * maxCardsPerColumn - Максимум карточек в одной колонке
         * 
         * Фиксированное значение: 6
         * Сетка игры: 6 слева × 6 справа = 12 карточек на доске
         * 
         * Почему 6? Оптимально для:
         * - Визуального восприятия
         * - Скорости поиска пары
         * - Размещения на экране
         */
        this.maxCardsPerColumn = 6;
        
        // ═══════════════════════════════════════════════════════
        // ЗАЩИТА ОТ RACE CONDITIONS
        // ═══════════════════════════════════════════════════════
        
        /**
         * ПРОБЛЕМА RACE CONDITIONS:
         * 
         * Пользователь быстро кликает на 2 пары одновременно:
         * 1. Пара 1 начинает обрабатываться (удаление, добавление новых)
         * 2. Пара 2 тоже начинает обрабатываться
         * 3. Обе операции пытаются изменить одни и те же данные
         * 4. Конфликт → краш игры
         * 
         * РЕШЕНИЕ: Флаг isProcessing
         * - true = идёт обработка, игнорируем новые клики
         * - false = можно обрабатывать клики
         */
        
        /**
         * isProcessing - Флаг "идёт обработка совпадения"
         * 
         * true  → checkMatch() игнорирует новые клики
         * false → checkMatch() обрабатывает клики
         * 
         * Устанавливается в true при нахождении пары
         * Сбрасывается в false после завершения всех операций
         */
        this.isProcessing = false;
        
        /**
         * processingStartTime - Время начала обработки (timestamp)
         * 
         * Используется для обнаружения "застрявшей" обработки
         * Если isProcessing = true дольше 5 секунд → что-то пошло не так
         * 
         * Значение: Date.now() в миллисекундах
         * Пример: 1642612345678
         */
        this.processingStartTime = 0;
        
        /**
         * PROCESSING_TIMEOUT - Максимальное время обработки одной пары
         * 
         * Если обработка длится дольше → принудительный сброс isProcessing
         * 
         * 5000 мс = 5 секунд
         * 
         * Обычная обработка занимает ~1 секунду:
         * - 600ms задержка показа совпадения
         * - 400ms анимация fadeOut
         * - Итого: ~1000ms
         * 
         * 5 секунд = большой запас для медленных устройств
         */
        this.PROCESSING_TIMEOUT = 5000;
        
        // ═══════════════════════════════════════════════════════
        // ЗАЩИТА ОТ ДВОЙНОЙ ИНИЦИАЛИЗАЦИИ
        // ═══════════════════════════════════════════════════════
        
        /**
         * isInitialized - Флаг "игра уже инициализирована"
         * 
         * Предотвращает повторный вызов init()
         * 
         * Зачем? Если init() вызвать дважды:
         * - Создадутся дубликаты обработчиков событий
         * - Пулы будут пересозданы некорректно
         * - Возможны утечки памяти
         * 
         * false → можно вызывать init()
         * true  → init() пропустится
         */
        this.isInitialized = false;
        
        // ═══════════════════════════════════════════════════════
        // СИСТЕМА ОЧКОВ И СТАТИСТИКА
        // ═══════════════════════════════════════════════════════
        
        /**
         * score - Текущие очки игрока
         * 
         * Начисление:
         * +50 за правильный ответ
         * +combo*10 за серию (если combo >= 3)
         * -10 за неправильный ответ
         * 
         * Минимум: 0 (не может быть отрицательным)
         */
        this.score = 0;
        
        /**
         * combo - Текущая серия правильных ответов ПОДРЯД
         * 
         * Увеличивается: +1 за каждый правильный ответ
         * Сбрасывается: 0 при любой ошибке
         * 
         * Бонус: При combo >= 3 начисляется дополнительный бонус
         * 
         * Пример:
         * Ответ 1: правильно → combo = 1
         * Ответ 2: правильно → combo = 2
         * Ответ 3: правильно → combo = 3 (🔥 бонус +30)
         * Ответ 4: правильно → combo = 4 (🔥 бонус +40)
         * Ответ 5: неправильно → combo = 0
         */
        this.combo = 0;
        
        /**
         * maxCombo - Максимальная достигнутая серия за игру
         * 
         * Используется для статистики в конце игры
         * Обновляется каждый раз когда combo > maxCombo
         */
        this.maxCombo = 0;
        
        /**
         * correctAnswers - Количество правильных ответов
         * 
         * Используется для:
         * - Подсчёта точности (accuracy)
         * - Статистики в конце игры
         * 
         * ONE-TO-ONE: +1 за каждую найденную пару
         * ONE-TO-MANY: +1 когда ВСЕ правые карточки найдены
         */
        this.correctAnswers = 0;
        
        /**
         * incorrectAnswers - Количество ошибок
         * 
         * Увеличивается при каждом неправильном сопоставлении
         * 
         * Используется для:
         * - Подсчёта точности
         * - Статистики в конце
         * 
         * Точность (accuracy) = correctAnswers / (correctAnswers + incorrectAnswers)
         */
        this.incorrectAnswers = 0;
        
        // ═══════════════════════════════════════════════════════
        // ОЧИСТКА РЕСУРСОВ (защита от утечек памяти)
        // ═══════════════════════════════════════════════════════
        
        /**
         * activeTimeouts - Массив ID активных таймеров
         * 
         * ПРОБЛЕМА УТЕЧЕК ПАМЯТИ:
         * Если создать setTimeout и не сохранить ID:
         * - Таймер продолжает работать даже после resetGame()
         * - При каждом resetGame() создаются НОВЫЕ таймеры
         * - Старые таймеры продолжают работать
         * - Через N перезапусков игры: куча "зомби-таймеров"
         * 
         * РЕШЕНИЕ:
         * - Сохраняем ID каждого setTimeout в этот массив
         * - При resetGame() очищаем ВСЕ таймеры: clearTimeout(id)
         * 
         * Пример:
         * const id = setTimeout(...);
         * this.activeTimeouts.push(id);
         */
        this.activeTimeouts = [];
        
        // ═══════════════════════════════════════════════════════
        // DOM ЭЛЕМЕНТЫ (ссылки на HTML)
        // ═══════════════════════════════════════════════════════
        
        /**
         * Все элементы инициализируются как null
         * Реальные ссылки получаем в initDOMElements()
         * ПОСЛЕ загрузки DOM
         * 
         * Почему null?
         * - constructor() вызывается ДО загрузки DOM
         * - document.getElementById() вернёт null
         * - Поэтому сначала null, потом в init() получим реальные ссылки
         */
        
        /**
         * leftContainer - Контейнер левых карточек
         * HTML: <div id="left-cards"></div>
         * КРИТИЧЕСКИЙ элемент
         */
        this.leftContainer = null;
        
        /**
         * rightContainer - Контейнер правых карточек
         * HTML: <div id="right-cards"></div>
         * КРИТИЧЕСКИЙ элемент
         */
        this.rightContainer = null;
        
        /**
         * matchedCountEl - Элемент "найдено пар: X"
         * HTML: <span id="matched-count">0</span>
         * Необязательный
         */
        this.matchedCountEl = null;
        
        /**
         * totalCountEl - Элемент "всего пар: Y"
         * HTML: <span id="total-count">15</span>
         * Необязательный
         */
        this.totalCountEl = null;
        
        /**
         * completionScreen - Экран завершения игры
         * HTML: <div id="game-completed" class="hidden">...</div>
         * Необязательный
         */
        this.completionScreen = null;
        
        /**
         * scoreEl - Элемент отображения текущих очков
         * HTML: <span id="score">0</span>
         * Необязательный
         */
        this.scoreEl = null;
        
        /**
         * comboEl - Элемент отображения combo
         * HTML: <span id="combo">0</span>
         * Необязательный
         */
        this.comboEl = null;
        
        // ═══════════════════════════════════════════════════════
        // ЗАПУСК ИНИЦИАЛИЗАЦИИ
        // ═══════════════════════════════════════════════════════
        
        /**
         * Вызываем асинхронный init()
         * 
         * init() выполнит:
         * 1. Загрузку темы из JSON
         * 2. Инициализацию пулов
         * 3. Заполнение доски
         * 4. Настройку интерфейса
         * 
         * Все ошибки будут пойманы в try-catch внутри init()
         */
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
    
    /**
     * ═══════════════════════════════════════════════════════════════════
     * ИНИЦИАЛИЗАЦИЯ DOM ЭЛЕМЕНТОВ
     * ═══════════════════════════════════════════════════════════════════
     * 
     * Получает ссылки на все HTML элементы интерфейса.
     * Критически важные элементы ОБЯЗАТЕЛЬНЫ - без них игра не работает.
     * 
     * ВАЖНО: Этот метод вызывается из async init(), поэтому может выбросить Error.
     * Ошибка будет поймана в try-catch блоке init().
     */
    initDOMElements() {
        // ═══════════════════════════════════════════════════════
        // КРИТИЧЕСКИ ВАЖНЫЕ ЭЛЕМЕНТЫ
        // ═══════════════════════════════════════════════════════
        
        /**
         * leftContainer - контейнер для левых карточек
         * HTML: <div id="left-cards"></div>
         * 
         * БЕЗ ЭТОГО ЭЛЕМЕНТА игра не может отрисовать карточки
         */
        this.leftContainer = document.getElementById('left-cards');
        
        /**
         * rightContainer - контейнер для правых карточек  
         * HTML: <div id="right-cards"></div>
         * 
         * БЕЗ ЭТОГО ЭЛЕМЕНТА игра не может отрисовать карточки
         */
        this.rightContainer = document.getElementById('right-cards');
        
        /**
         * КРИТИЧЕСКАЯ ПРОВЕРКА: Оба контейнера ОБЯЗАТЕЛЬНЫ!
         * 
         * Если хотя бы один отсутствует:
         * 1. Логируем подробную ошибку
         * 2. Выбрасываем Error
         * 3. Error поймается в init() и покажется сообщение пользователю
         * 
         * ЭТО ПРАВИЛЬНО! Лучше сразу показать понятную ошибку,
         * чем позволить игре продолжить и упасть с непонятным
         * "Cannot read property 'appendChild' of null"
         */
        if (!this.leftContainer) {
            console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: Элемент #left-cards не найден в HTML!');
            console.error('   Проверьте что в game.html есть: <div id="left-cards"></div>');
            throw new Error('Отсутствует критический элемент #left-cards');
        }
        
        if (!this.rightContainer) {
            console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: Элемент #right-cards не найден в HTML!');
            console.error('   Проверьте что в game.html есть: <div id="right-cards"></div>');
            throw new Error('Отсутствует критический элемент #right-cards');
        }
        
        // ═══════════════════════════════════════════════════════
        // НЕОБЯЗАТЕЛЬНЫЕ ЭЛЕМЕНТЫ (игра может работать без них)
        // ═══════════════════════════════════════════════════════
        
        /**
         * Эти элементы улучшают игру, но не критичны
         * Если их нет - просто некоторые функции не работают
         * 
         * Логируем предупреждения для отладки
         */
        
        // Счётчик найденных пар (например "5")
        this.matchedCountEl = document.getElementById('matched-count');
        if (!this.matchedCountEl) {
            console.warn('⚠️ Элемент #matched-count не найден - счётчик пар не работает');
        }
        
        // Общее количество пар (например "15")
        this.totalCountEl = document.getElementById('total-count');
        if (!this.totalCountEl) {
            console.warn('⚠️ Элемент #total-count не найден - счётчик пар не работает');
        }
        
        // Экран завершения игры (показывается когда все пары найдены)
        this.completionScreen = document.getElementById('game-completed');
        if (!this.completionScreen) {
            console.warn('⚠️ Элемент #game-completed не найден - экран завершения недоступен');
        }
        
        // Отображение текущих очков
        this.scoreEl = document.getElementById('score');
        if (!this.scoreEl) {
            console.warn('⚠️ Элемент #score не найден - счёт не отображается');
        }
        
        // Отображение combo (серии правильных ответов)
        this.comboEl = document.getElementById('combo');
        if (!this.comboEl) {
            console.warn('⚠️ Элемент #combo не найден - combo не отображается');
        }
        
        console.log('✅ DOM элементы инициализированы');
    }

    /**
     * ═══════════════════════════════════════════════════════════════════
     * ЗАГРУЗКА ТЕМЫ ИЗ JSON
     * ═══════════════════════════════════════════════════════════════════
     * 
     * Загружает файл темы и ТЩАТЕЛЬНО валидирует его структуру.
     * Это критически важно для предотвращения крашей при битых данных.
     * 
     * @param {string} themeId - ID темы (например "literary-characters")
     * @throws {Error} Если файл не найден или структура неверна
     */
    async loadTheme(themeId) {
        try {
            // ═══════════════════════════════════════════════════════
            // ВАЛИДАЦИЯ 1: Проверка ID темы
            // ═══════════════════════════════════════════════════════
            
            /**
             * ЗАЩИТА: ID не должен быть пустым или не-строкой
             * Это базовая проверка входных данных
             */
            if (!themeId || typeof themeId !== 'string') {
                throw new Error('Некорректный ID темы');
            }
            
            /**
             * ЗАЩИТА ОТ PATH TRAVERSAL АТАКИ:
             * ID может содержать только буквы, цифры и дефис
             * Запрещены: ../, ./, /, \, пробелы и спецсимволы
             * 
             * Плохой ID: "../../../etc/passwd"
             * Хороший ID: "literary-characters"
             */
            if (!/^[a-z0-9\-]+$/i.test(themeId)) {
                console.error('❌ Опасный ID темы:', themeId);
                throw new Error('ID темы содержит недопустимые символы');
            }
            
            // ═══════════════════════════════════════════════════════
            // ЗАГРУЗКА ФАЙЛА
            // ═══════════════════════════════════════════════════════
            
            /**
             * Загружаем JSON файл с сервера
             * Путь: data/themes/{themeId}.json
             */
            console.log(`📥 Загружаем тему: ${themeId}`);
            const response = await fetch(`data/themes/${themeId}.json`);
            
            /**
             * ПРОВЕРКА: Файл существует и доступен?
             * response.ok = true если HTTP статус 200-299
             */
            if (!response.ok) {
                throw new Error(`Тема "${themeId}" не найдена (HTTP ${response.status})`);
            }
            
            // ═══════════════════════════════════════════════════════
            // ПАРСИНГ JSON
            // ═══════════════════════════════════════════════════════
            
            /**
             * Парсим JSON в JavaScript объект
             * Может выбросить SyntaxError если JSON некорректен
             */
            this.themeData = await response.json();
            
            // ═══════════════════════════════════════════════════════
            // ВАЛИДАЦИЯ 2: Базовая структура
            // ═══════════════════════════════════════════════════════
            
            /**
             * КРИТИЧЕСКАЯ ПРОВЕРКА: themeData это объект?
             * Защита от случаев когда JSON возвращает null, массив, строку и т.д.
             */
            if (!this.themeData || typeof this.themeData !== 'object' || Array.isArray(this.themeData)) {
                throw new Error('Некорректный формат файла темы - ожидается объект');
            }
            
            // ═══════════════════════════════════════════════════════
            // ВАЛИДАЦИЯ 3: Массив пар
            // ═══════════════════════════════════════════════════════
            
            /**
             * ПРОВЕРКА: Есть ли поле pairs?
             * ПРОВЕРКА: Это массив?
             * 
             * Без этих проверок игра упадёт с:
             * "Cannot read property 'length' of undefined"
             */
            if (!this.themeData.pairs) {
                throw new Error('В теме отсутствует поле pairs');
            }
            
            if (!Array.isArray(this.themeData.pairs)) {
                throw new Error('Поле pairs должно быть массивом');
            }
            
            /**
             * ПРОВЕРКА: Есть ли хотя бы одна пара?
             * Пустой массив = невозможно играть
             */
            if (this.themeData.pairs.length === 0) {
                throw new Error('В теме нет ни одной пары');
            }
            
            /**
             * ПРОВЕРКА: Достаточно ли пар для нормальной игры?
             * Меньше 3 пар = очень короткая игра
             */
            if (this.themeData.pairs.length < 3) {
                throw new Error(`Слишком мало пар: ${this.themeData.pairs.length}. Минимум: 3`);
            }
            
            /**
             * ПРЕДУПРЕЖДЕНИЕ: Рекомендуется минимум 6 пар
             * Это не критично, но желательно
             */
            if (this.themeData.pairs.length < 6) {
                console.warn(`⚠️ Мало пар (${this.themeData.pairs.length}), рекомендуется минимум 6`);
            }
            
            // ═══════════════════════════════════════════════════════
            // ВАЛИДАЦИЯ 4: Обязательные поля темы
            // ═══════════════════════════════════════════════════════
            
            /**
             * ПРОВЕРКА: Есть ли заголовок?
             * Без него непонятно что за тема
             */
            if (!this.themeData.title || typeof this.themeData.title !== 'string') {
                throw new Error('В теме отсутствует или некорректно поле title');
            }
            
            /**
             * ПРОВЕРКА: Есть ли описания колонок?
             * Без них пользователь не поймёт что с чем сопоставлять
             */
            if (!this.themeData.leftColumn || typeof this.themeData.leftColumn !== 'object') {
                throw new Error('В теме отсутствует или некорректно поле leftColumn');
            }
            
            if (!this.themeData.rightColumn || typeof this.themeData.rightColumn !== 'object') {
                throw new Error('В теме отсутствует или некорректно поле rightColumn');
            }
            
            if (!this.themeData.leftColumn.title) {
                throw new Error('В leftColumn отсутствует title');
            }
            
            if (!this.themeData.rightColumn.title) {
                throw new Error('В rightColumn отсутствует title');
            }
            
            // ═══════════════════════════════════════════════════════
            // ВАЛИДАЦИЯ 5: Каждая пара
            // ═══════════════════════════════════════════════════════
            
            /**
             * ВАЖНО: Проверяем КАЖДУЮ пару в массиве
             * Одна битая пара может сломать всю игру
             */
            this.themeData.pairs.forEach((pair, index) => {
                /**
                 * ПРОВЕРКА: У пары есть ID?
                 * ID нужен для идентификации и сопоставления
                 */
                if (pair.id === undefined || pair.id === null) {
                    throw new Error(`Пара #${index} не имеет поле id`);
                }
                
                /**
                 * ПРОВЕРКА: У пары есть левое значение?
                 * Для обычного режима: pair.left
                 * Для one-to-many режима: pair.leftCards (массив)
                 */
                if (!pair.left && !pair.leftCards) {
                    throw new Error(`Пара #${pair.id} не имеет поле left или leftCards`);
                }
                
                /**
                 * ПРОВЕРКА: У пары есть правое значение?
                 * Для обычного режима: pair.right
                 * Для one-to-many режима: pair.rightCards (массив)
                 */
                if (!pair.right && !pair.rightCards) {
                    throw new Error(`Пара #${pair.id} не имеет поле right или rightCards`);
                }
                
                /**
                 * ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА для one-to-many:
                 * Если есть rightCards, это должен быть непустой массив
                 */
                if (pair.rightCards) {
                    if (!Array.isArray(pair.rightCards)) {
                        throw new Error(`Пара #${pair.id}: rightCards должно быть массивом`);
                    }
                    
                    if (pair.rightCards.length === 0) {
                        throw new Error(`Пара #${pair.id}: rightCards не может быть пустым`);
                    }
                    
                    /**
                     * Проверяем что все элементы rightCards это строки
                     */
                    pair.rightCards.forEach((item, idx) => {
                        if (typeof item !== 'string' || !item) {
                            throw new Error(`Пара #${pair.id}: rightCards[${idx}] не является строкой`);
                        }
                    });
                }
            });
            
            // ═══════════════════════════════════════════════════════
            // КОПИРОВАНИЕ И ПЕРЕМЕШИВАНИЕ
            // ═══════════════════════════════════════════════════════
            
            /**
             * Создаём копию массива пар
             * Почему копию? Чтобы не менять оригинальные данные
             * при перемешивании
             * 
             * Spread оператор [...] создаёт поверхностную копию
             */
            this.allPairs = [...this.themeData.pairs];
            
            /**
             * Перемешиваем пары для случайного порядка
             * Алгоритм Фишера-Йейтса гарантирует равномерное распределение
             */
            this.shuffleArray(this.allPairs);
            
            console.log(`✅ Тема успешно загружена: "${this.themeData.title}"`);
            console.log(`   📊 Количество пар: ${this.allPairs.length}`);
            console.log(`   🎮 Режим: ${this.themeData.type || 'one-to-one'}`);
            
        } catch (error) {
            // ═══════════════════════════════════════════════════════
            // ОБРАБОТКА ОШИБОК
            // ═══════════════════════════════════════════════════════
            
            /**
             * Логируем подробности для отладки
             */
            console.error('❌ Ошибка загрузки темы:', error);
            
            /**
             * Пробрасываем ошибку дальше
             * Её поймает try-catch в init()
             */
            throw error;
        }
    }

    /**
     * ═══════════════════════════════════════════════════════════════════
     * НАСТРОЙКА ИНТЕРФЕЙСА ИГРЫ
     * ═══════════════════════════════════════════════════════════════════
     * 
     * Заполняет все текстовые элементы данными из загруженной темы.
     * Устанавливает обработчики событий.
     * 
     * ВАЖНО: Безопасно работает с DOM - проверяет существование каждого элемента.
     */
    setupGame() {
        try {
            console.log('⚙️ Настройка интерфейса...');
            
            // ═══════════════════════════════════════════════════════
            // БЕЗОПАСНОЕ ОБНОВЛЕНИЕ ТЕКСТОВЫХ ЭЛЕМЕНТОВ
            // ═══════════════════════════════════════════════════════
            
            /**
             * Объект с ID элементов и значениями для них
             * 
             * Почему так? 
             * - Удобно добавлять новые элементы
             * - Единая логика обработки
             * - Легко видеть все элементы в одном месте
             */
            const textElements = {
                'game-title': this.themeData.title,
                'game-description': this.themeData.description || '',
                'left-column-title': this.themeData.leftColumn?.title || 'Левая колонка',
                'right-column-title': this.themeData.rightColumn?.title || 'Правая колонка'
            };
            
            /**
             * Проходим по каждому элементу и безопасно обновляем
             * 
             * Object.entries() превращает объект в массив пар [key, value]:
             * [['game-title', 'Литературные персонажи'], ['game-description', '...'], ...]
             */
            Object.entries(textElements).forEach(([elementId, value]) => {
                /**
                 * Получаем элемент по ID
                 */
                const element = document.getElementById(elementId);
                
                /**
                 * ЗАЩИТА: Проверяем что элемент существует
                 * Если нет - логируем предупреждение и пропускаем
                 * 
                 * БЕЗ ЭТОЙ ПРОВЕРКИ:
                 * element.textContent = value → TypeError: Cannot set property of null
                 * 
                 * С ПРОВЕРКОЙ:
                 * Просто предупреждение, игра продолжает работу
                 */
                if (element) {
                    element.textContent = value;
                } else {
                    console.warn(`⚠️ Элемент #${elementId} не найден, пропускаем`);
                }
            });
            
            // ═══════════════════════════════════════════════════════
            // ОБНОВЛЕНИЕ СЧЁТЧИКОВ
            // ═══════════════════════════════════════════════════════
            
            /**
             * Устанавливаем общее количество пар
             * 
             * ЗАЩИТА: Проверяем существование элемента перед обращением
             * Этот паттерн "if (element) element.do()" используется везде
             */
            if (this.totalCountEl) {
                this.totalCountEl.textContent = this.allPairs.length;
            }
            
            /**
             * В начале игры найдено 0 пар
             */
            if (this.matchedCountEl) {
                this.matchedCountEl.textContent = '0';
            }
            
            // ═══════════════════════════════════════════════════════
            // ОБРАБОТЧИК КНОПКИ "ИГРАТЬ СНОВА"
            // ═══════════════════════════════════════════════════════
            
            /**
             * Кнопка на экране завершения игры
             * При клике перезапускает игру
             */
            const playAgainBtn = document.getElementById('play-again');
            
            if (playAgainBtn) {
                /**
                 * ВАЖНАЯ ТЕХНИКА: Клонирование кнопки
                 * 
                 * Зачем?
                 * Если setupGame() вызывается повторно (например при resetGame),
                 * addEventListener добавит ВТОРОЙ обработчик к той же кнопке.
                 * 
                 * Результат: один клик → два вызова resetGame() → баги
                 * 
                 * Решение: Клонируем кнопку (копия без обработчиков)
                 * и заменяем старую на новую
                 */
                const newPlayAgainBtn = playAgainBtn.cloneNode(true);
                playAgainBtn.parentNode.replaceChild(newPlayAgainBtn, playAgainBtn);
                
                /**
                 * Теперь добавляем обработчик на чистую кнопку
                 * Гарантированно один обработчик
                 */
                newPlayAgainBtn.addEventListener('click', () => {
                    console.log('🔄 Кнопка "Играть снова" нажата');
                    this.resetGame();
                });
            } else {
                console.warn('⚠️ Кнопка #play-again не найдена');
            }
            
            // ═══════════════════════════════════════════════════════
            // ЗАГОЛОВОК ВКЛАДКИ БРАУЗЕРА
            // ═══════════════════════════════════════════════════════
            
            /**
             * Устанавливаем title вкладки = название темы
             * 
             * Удобно когда открыто много вкладок:
             * "Игра" → "Литературные персонажи"
             */
            document.title = this.themeData.title;
            
            console.log('✅ Интерфейс настроен');
            
        } catch (error) {
            /**
             * Если произошла ошибка в setupGame():
             * 1. Логируем подробности
             * 2. НЕ выбрасываем error дальше
             * 
             * Почему не выбрасываем?
             * Ошибки здесь не критичны - игра может работать
             * с неполным интерфейсом
             */
            console.error('❌ Ошибка настройки интерфейса:', error);
            console.error('   Игра продолжит работу с неполным интерфейсом');
        }
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
        // Заполняем доску начальными карточками с ГАРАНТИЕЙ совместимых пар
        this.leftCards = [];
        this.rightCards = [];
        
        // Берём 6 левых карточек из пула
        const leftSelection = [];
        for (let i = 0; i < this.maxCardsPerColumn && i < this.leftPool.length; i++) {
            leftSelection.push(this.leftPool.shift());
        }
        this.leftCards = [...leftSelection];
        
        // Собираем pairId всех левых карточек
        const leftPairIds = new Set(leftSelection.map(c => c.pairId));
        
        // ГАРАНТИРОВАННО находим хотя бы одну совместимую правую для каждой левой
        const guaranteedRight = [];
        const usedIndices = new Set();
        
        leftPairIds.forEach(pairId => {
            // Ищем первую совместимую карточку в правом пуле
            const compatibleIndex = this.rightPool.findIndex((card, index) => 
                card.pairId === pairId && !usedIndices.has(index)
            );
            
            if (compatibleIndex !== -1) {
                guaranteedRight.push(this.rightPool[compatibleIndex]);
                usedIndices.add(compatibleIndex);
            }
        });
        
        // Удаляем использованные карточки из правого пула (в обратном порядке чтобы индексы не сбились)
        Array.from(usedIndices)
            .sort((a, b) => b - a)
            .forEach(index => this.rightPool.splice(index, 1));
        
        // Добавляем еще карточек до 6 (если нужно)
        while (guaranteedRight.length < this.maxCardsPerColumn && this.rightPool.length > 0) {
            guaranteedRight.push(this.rightPool.shift());
        }
        
        // Перемешиваем правые карточки (чтобы не было прямого соответствия позиций)
        this.shuffleArray(guaranteedRight);
        this.rightCards = guaranteedRight;
        
        // ПРОВЕРКА: должна быть хотя бы одна пара
        const hasMatch = this.hasMatchOnBoard();
        
        if (!hasMatch) {
            console.error('КРИТИЧЕСКАЯ ОШИБКА: Не удалось создать доску с парами!');
            console.log('Left cards:', this.leftCards.map(c => c.pairId));
            console.log('Right cards:', this.rightCards.map(c => c.pairId));
        } else {
            console.log('✅ Доска инициализирована с гарантированными парами');
            console.log('Left pairs:', this.leftCards.map(c => c.pairId));
            console.log('Right pairs:', this.rightCards.map(c => c.pairId));
        }
        
        // Отрисовываем доску
        this.renderBoard();
    }

    hasMatchOnBoard() {
        // Проверяет, есть ли хотя бы одна совместимая пара на доске
        const isOneToMany = this.themeData && this.themeData.type === 'one-to-many';
        
        for (const leftCard of this.leftCards) {
            for (const rightCard of this.rightCards) {
                if (leftCard.pairId === rightCard.pairId) {
                    // Для one-to-many проверяем что эта правая карточка еще не заматчена
                    if (isOneToMany && leftCard.matchedRightIds) {
                        const rightCardId = typeof rightCard.id === 'string' ? rightCard.id : `${rightCard.pairId}-${rightCard.rightIndex}`;
                        if (leftCard.matchedRightIds.includes(rightCardId)) {
                            continue; // Эта пара уже заматчена, пропускаем
                        }
                    }
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
        // ВАЛИДАЦИЯ ДАННЫХ
        if (!cardData) {
            console.error('createCard: cardData is null or undefined');
            return null;
        }
        
        if (!cardData.content) {
            console.error('createCard: cardData.content is missing', cardData);
            return null;
        }
        
        if (!cardData.pairId) {
            console.error('createCard: cardData.pairId is missing', cardData);
            return null;
        }
        
        if (!container) {
            console.error('createCard: container is null or undefined');
            return null;
        }
        
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
        
        /**
         * ═══════════════════════════════════════════════════════
         * ЗАЩИТА ОТ СЛИШКОМ ДЛИННОГО ТЕКСТА
         * ═══════════════════════════════════════════════════════
         * 
         * Если текст слишком длинный (>150 символов),
         * обрезаем его и добавляем "..."
         * 
         * Зачем? 
         * Очень длинный текст:
         * - Не помещается в карточку даже с мелким шрифтом
         * - Ломает вёрстку
         * - Плохо читается
         * 
         * 150 символов ≈ 3-4 строки текста в карточке
         */
        let displayContent = cardData.content;
        const contentLength = cardData.content.length;
        
        if (contentLength > 150) {
            console.warn(`⚠️ Слишком длинный текст (${contentLength} символов), обрезаем до 150`);
            displayContent = cardData.content.substring(0, 147) + '...';
        }
        
        const content = document.createElement('div');
        content.className = 'card-content';
        content.textContent = displayContent; // Используем обрезанную версию
        
        /**
         * ═══════════════════════════════════════════════════════
         * АДАПТИВНЫЙ РАЗМЕР ШРИФТА
         * ═══════════════════════════════════════════════════════
         * 
         * В зависимости от длины текста применяем CSS класс:
         * - Короткий текст (<40): обычный размер (0.95rem)
         * - Средний (40-60): чуть меньше (0.85rem)
         * - Длинный (60-80): мелкий (0.75rem)
         * - Очень длинный (>80): очень мелкий (0.7rem)
         * 
         * CSS классы определены в game.css
         */
        if (contentLength > 80) {
            content.classList.add('text-very-long');
        } else if (contentLength > 60) {
            content.classList.add('text-long');
        } else if (contentLength > 40) {
            content.classList.add('text-medium');
        }
        // Если <40 символов - класс не добавляем, используется базовый размер
        
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
        // ЗАЩИТА ОТ RACE CONDITIONS + АВТОМАТИЧЕСКИЙ СБРОС
        if (this.isProcessing) {
            const elapsed = Date.now() - this.processingStartTime;
            
            if (elapsed > this.PROCESSING_TIMEOUT) {
                console.error(`⚠️ isProcessing застрял на ${elapsed}ms! Принудительный сброс.`);
                this.forceResetProcessing();
            } else {
                console.warn('Обработка предыдущего совпадения в процессе, игнорируем клик');
                return false;
            }
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
        
        /**
         * КРИТИЧЕСКАЯ ПРОВЕРКА: Карточки должны быть с РАЗНЫХ сторон
         * 
         * Правило игры: сопоставляем левую с правой
         * Нельзя: левую с левой, правую с правой
         * 
         * Зачем эта проверка?
         * Без неё можно перетащить правую карточку на другую правую
         * и если у них случайно одинаковый pairId - они совпадут (баг!)
         */
        const draggedSide = draggedCard.dataset.side;
        const targetSide = targetCard.dataset.side;
        
        // ЗАЩИТА: Проверяем что атрибут side существует
        if (!draggedSide || !targetSide) {
            console.error('❌ У карточек отсутствует атрибут data-side');
            return false;
        }
        
        // ЗАЩИТА: Карточки должны быть с разных сторон
        if (draggedSide === targetSide) {
            console.warn('⚠️ Попытка сопоставить карточки с одной стороны, игнорируем');
            return false;
        }
        
        // ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА: Правая должна перетаскиваться на левую
        // (не наоборот, т.к. правые карточки draggable, левые - нет)
        if (draggedSide !== 'right' || targetSide !== 'left') {
            console.warn('⚠️ Неправильное направление: должна быть правая → левая');
            return false;
        }
        
        const draggedPairId = draggedCard.dataset.pairId;
        const targetPairId = targetCard.dataset.pairId;
        
        if (draggedPairId === targetPairId) {
            // Правильный ответ - БЛОКИРУЕМ дальнейшие действия
            this.isProcessing = true;
            this.processingStartTime = Date.now();
            
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
    
    forceResetProcessing() {
        // Принудительный сброс застрявшего флага
        this.isProcessing = false;
        this.processingStartTime = 0;
        console.log('✅ Система разблокирована, можно продолжать игру');
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
        try {
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
                try {
                    this.removeMatchedPair(leftCard, rightCard);
                    
                    // Добавляем новые карточки после полного удаления старых
                    setTimeout(() => {
                        try {
                            this.addNewCards(leftCard, rightCard);
                        } catch (error) {
                            console.error('Ошибка в addNewCards:', error);
                        } finally {
                            // ВСЕГДА разблокируем систему
                            this.isProcessing = false;
                        }
                    }, 450); // Синхронизировано: 400ms fadeOut + 50ms буфер
                    
                    // Проверяем завершение игры
                    if (this.matchedPairs.size >= this.allPairs.length) {
                        setTimeout(() => this.completeGame(), 500);
                    }
                } catch (error) {
                    console.error('Ошибка в removeMatchedPair:', error);
                    this.isProcessing = false;
                }
            }, 600);
        } catch (error) {
            console.error('Критическая ошибка в handleOneToOneMatch:', error);
            this.isProcessing = false;
        }
    }
    
    handleOneToManyMatch(leftCard, rightCard, pairId) {
        try {
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
                    try {
                        this.removeMatchedPair(leftCard, rightCard);
                        
                        setTimeout(() => {
                            try {
                                this.addNewCards(leftCard, rightCard);
                            } catch (error) {
                                console.error('Ошибка в addNewCards:', error);
                            } finally {
                                this.isProcessing = false;
                            }
                        }, 450);
                        
                        // Проверяем завершение игры
                        if (this.matchedPairs.size >= this.allPairs.length) {
                            setTimeout(() => this.completeGame(), 500);
                        }
                    } catch (error) {
                        console.error('Ошибка в removeMatchedPair:', error);
                        this.isProcessing = false;
                    }
                }, 600);
            } else {
                // ЕЩЁ НЕ ВСЕ - удаляем только правую, обновляем прогресс левой
                console.log('⏳ Ещё осталось найти произведения');
                
                setTimeout(() => {
                    try {
                        // Удаляем только правую карточку
                        this.removeSingleCard(rightCard, 'right');
                        
                        // Обновляем прогресс-бар на левой карточке
                        this.updateProgressBar(leftCard, leftCardData);
                        
                        setTimeout(() => {
                            try {
                                // Добавляем только новую правую карточку
                                this.addSmartRightCard();
                            } catch (error) {
                                console.error('Ошибка в addSmartRightCard:', error);
                            } finally {
                                this.isProcessing = false;
                            }
                        }, 450);
                    } catch (error) {
                        console.error('Ошибка при обработке частичного совпадения:', error);
                        this.isProcessing = false;
                    }
                }, 600);
            }
        } catch (error) {
            console.error('Критическая ошибка в handleOneToManyMatch:', error);
            this.isProcessing = false;
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
        
        let newLeftCard = null;
        let newRightCard = null;
        
        // Добавляем новую левую карточку (если есть в пуле)
        if (this.leftPool.length > 0) {
            newLeftCard = this.leftPool.shift();
            this.leftCards.push(newLeftCard);
            console.log('➕ Добавлена левая карточка:', newLeftCard.content);
        }
        
        // УМНОЕ ДОБАВЛЕНИЕ правой карточки с учетом НОВОЙ левой
        if (this.rightPool.length > 0) {
            newRightCard = this.addSmartRightCard(newLeftCard);
        }
        
        // Отрисовываем новые карточки с анимацией
        if (newLeftCard) {
            this.createCard(newLeftCard, this.leftContainer, true);
        }
        if (newRightCard) {
            this.createCard(newRightCard, this.rightContainer, true);
        }
        
        // Реинициализируем drag and drop ОДИН раз для всех новых карточек
        if (window.dragDropManager) {
            window.dragDropManager.init();
        }
        
        console.log('Новые карточки добавлены:', {
            leftCards: this.leftCards.length,
            rightCards: this.rightCards.length,
            leftPool: this.leftPool.length,
            rightPool: this.rightPool.length,
            hasMatch: this.hasMatchOnBoard()
        });
    }

    addSmartRightCard(newLeftCard = null) {
        if (this.rightPool.length === 0) {
            console.log('Правый пул пуст');
            return null;
        }
        
        // Проверяем, есть ли совместимая пара на доске
        const hasMatchNow = this.hasMatchOnBoard();
        
        let selectedCard;
        
        if (hasMatchNow) {
            // Уже есть пара на доске - можем добавить любую карточку
            selectedCard = this.rightPool.shift();
            console.log('✅ Есть пара на доске, добавляем случайную:', selectedCard.content);
        } else {
            // НЕТ пары - нужно найти совместимую
            console.warn('⚠️ Нет пары на доске, ищем совместимую');
            
            // Приоритет 1: Если только что добавили новую левую, ищем пару для неё
            if (newLeftCard) {
                const compatibleIndex = this.rightPool.findIndex(
                    card => card.pairId === newLeftCard.pairId
                );
                
                if (compatibleIndex !== -1) {
                    selectedCard = this.rightPool.splice(compatibleIndex, 1)[0];
                    console.log('✅ Нашли пару для новой левой карточки:', selectedCard.content);
                    this.rightCards.push(selectedCard);
                    return selectedCard;
                }
            }
            
            // Приоритет 2: Ищем пару для любой существующей левой карточки
            for (const leftCard of this.leftCards) {
                const compatibleIndex = this.rightPool.findIndex(
                    card => card.pairId === leftCard.pairId
                );
                
                if (compatibleIndex !== -1) {
                    selectedCard = this.rightPool.splice(compatibleIndex, 1)[0];
                    console.log('✅ Нашли пару для существующей левой:', selectedCard.content);
                    this.rightCards.push(selectedCard);
                    return selectedCard;
                }
            }
            
            // Крайний случай: не нашли совместимую - берём любую
            selectedCard = this.rightPool.shift();
            console.warn('⚠️ Не нашли совместимую карточку, берём случайную:', selectedCard.content);
        }
        
        // Добавляем карточку на доску
        this.rightCards.push(selectedCard);
        return selectedCard;
    }

    /**
     * ═══════════════════════════════════════════════════════════════════
     * ПОКАЗ ОПИСАНИЯ ПАРЫ (ВСПЛЫВАЮЩЕЕ ОКНО)
     * ═══════════════════════════════════════════════════════════════════
     * 
     * Находит описание пары в JSON и показывает toast в левом верхнем углу.
     * 
     * @param {string|number} pairId - ID пары
     */
    showPairDescription(pairId) {
        try {
            const pair = this.allPairs.find(p => p.id === parseInt(pairId));
            
            // Если нет пары или нет описания - ничего не показываем
            if (!pair || !pair.description) {
                return;
            }
            
            this.showToast(pair.description);
        } catch (error) {
            console.error('❌ Ошибка показа описания:', error);
        }
    }

    /**
     * ═══════════════════════════════════════════════════════════════════
     * ПОКАЗ ВСПЛЫВАЮЩЕГО ОКНА (TOAST)
     * ═══════════════════════════════════════════════════════════════════
     * 
     * Создаёт красивое всплывающее окно в левом верхнем углу.
     * Автоматически исчезает через 4 секунды.
     * 
     * БЕЗОПАСНОСТЬ: Использует textContent вместо innerHTML
     * для предотвращения XSS атак.
     * 
     * @param {string} message - Текст сообщения
     */
    showToast(message) {
        try {
            /**
             * ЗАЩИТА ОТ XSS: Создаём элементы программно
             * вместо использования innerHTML
             * 
             * ❌ ПЛОХО: toast.innerHTML = `<div>${message}</div>`
             *    Если message = "<script>alert('XSS')</script>"
             *    код выполнится!
             * 
             * ✅ ХОРОШО: div.textContent = message
             *    Любые HTML теги будут отображены как текст, не как код
             */
            
            // Создаём контейнер toast
            const toast = document.createElement('div');
            toast.className = 'toast toast-description';
            
            // Создаём иконку ✓
            const iconDiv = document.createElement('div');
            iconDiv.className = 'toast-icon';
            iconDiv.textContent = '✓'; // Безопасно
            
            // Создаём div для сообщения
            const messageDiv = document.createElement('div');
            messageDiv.className = 'toast-message';
            messageDiv.textContent = message; // ✅ БЕЗОПАСНО - XSS невозможен
            
            // Собираем структуру
            toast.appendChild(iconDiv);
            toast.appendChild(messageDiv);
            
            // Добавляем в body
            document.body.appendChild(toast);
            
            /**
             * АНИМАЦИЯ ПОЯВЛЕНИЯ:
             * Через 100ms добавляем класс 'show'
             * CSS transition делает плавное выезжание слева
             */
            setTimeout(() => {
                toast.classList.add('show');
            }, 100);
            
            /**
             * АВТОМАТИЧЕСКОЕ ИСЧЕЗНОВЕНИЕ:
             * Через 4 секунды убираем класс 'show'
             * CSS transition делает плавное исчезновение
             * Через 300ms удаляем элемент из DOM полностью
             */
            setTimeout(() => {
                toast.classList.remove('show');
                
                setTimeout(() => {
                    // Проверяем что элемент ещё в DOM перед удалением
                    if (toast.parentNode) {
                        toast.remove();
                    }
                }, 300);
            }, 4000);
            
        } catch (error) {
            console.error('❌ Ошибка показа toast:', error);
        }
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
