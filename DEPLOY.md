# Деплой AI Calculator

## Подготовка к деплою

```bash
npm run build
```

Это создаст папку `dist/` со статическим файлом.

## Варианты деплоя

### 1. GitHub Pages (бесплатно)

#### Включить GitHub Pages:
1. Зайдите в настройки репозитория → Pages
2. Выберите ветку: `main` (или `master`) и папку `/ (root)`
3. Нажмите Save

#### Или через команду git:

```bash
# Создать ветку gh-pages
git checkout -b gh-pages

# Копировать файлы из dist/ в root папки gh-pages
cp -r dist/* .

# Добавить в git
git add .

# Закоммитьт и залить
git commit -m "deploy: github pages build"
git push origin gh-pages
```

### 2. Vercel (бесплатно, рекомендуемый)

Создайте проект на [vercel.com](https://vercel.com):
1. Нажмите "New Project"
2. Выберите свой GitHub репозиторий `AI_calculator`
3. Framework preset: **Vite**
4. Build command: `npm run build`
5. Output directory: `dist`

Нажмите **Deploy**!

### 3. Netlify (бесплатно)

1. Зайдите на [netlify.com](https://app.netlify.com)
2. Drag & drop папка `dist/` или подключите GitHub репозиторий
3. Build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`

### 4. Cloudflare Pages (бесплатно)

Через [dash.cloudflare.com](https://dash.cloudflare.com):
1. Создать проект
2. Connect Git → выберите репозиторий
3. Build configuration:
   - Build command: `npm run build`
   - Build output directory: `dist`

### 5. Любой static host (S3, Firebase, и др.)

Просто загрузите файлы из `dist/` в корневую папку хостинга.

## Автоматический деплой через Vercel/Netlify

В корне создайте файл `.vercelignore` или настройте в репозитории:

```bash
# Создаем .gitignore если нет
echo -e "node_modules\n.git\n*.log" > .gitignore

# Убедитесь что build работает
npm run build
```

## Локальный тест перед деплоем

```bash
npm run build
npx vite preview
```

Откройте `http://localhost:5173` в браузере и проверьте работу.

## Структура проекта

- `dist/` — готовые статические файлы для деплоя (после `npm run build`)
- `public/` — статические ассеты, которые копируются в `dist/`
- `src/` — исходный код React приложения

## Полезные команды

```bash
# Разработка
npm run dev

# Сборка для деплоя
npm run build

# Предпросмотр сборки локально
npx vite preview

# Проверка типов TypeScript
npm run typecheck

# Валидация данных
npm run validate:data
```

## Что внутри dist/ после build:

- `index.html` — основной HTML файл
- `/assets/` — скомпилированный JS, CSS, картинки
- Все данные и конфиги из `src/data/`

---

**Рекомендация:** Используйте **Vercel** — просто подключите GitHub репозиторий и нажимайте Deploy! 🚀
