# Деплой через GitHub Actions на Vercel

## Настройка переменных окружения

Зайдите в **Settings → Secrets and variables → Actions** вашего репозитория:

### 1. Добавить `VERCEL_ORG_ID`
- Это ID вашей организации Vercel (если её нет, создайте бесплатно на vercel.com)
- Если у вас только один проект, можно использовать публичный токен без organization

### 2. Добавить `VERCEL_TOKEN`
- Создайте персональный токен в Vercel: **Settings → General → User Tokens**
- Скопируйте токен и добавьте как Secret: `VERCEL_TOKEN`

### 3. Добавить `VERCEL_PROJECT_ID`
- Зайдите в ваш проект на Vercel
- URL вида: `https://vercel.com/YOUR_ORG/YOUR_PROJECT`
- Скопируйте часть после слеша (например: `llm-local-calculator`)
- Добавьте как Secret: `VERCEL_PROJECT_ID`

## Альтернативный простой способ — без Secrets

Создайте файл `.github/workflows/deploy-simple.yml`:

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  deploy:
    name: Deploy
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Deploy to Vercel (simple)
        uses: vercel/actions@v3
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          working-directory: .
          args: '--prod --yes'
```

## Проверка после настройки

После добавления Secrets:
1. Сделайте тестовый пуш на `main` ветку
2. Проверьте логи в **Settings → Actions** репозитория
3. Если всё успешно — проект опубликуется автоматически

## Без Vercel — просто статический хостинг

Если хотите просто залить статику (GitHub Pages, Netlify, S3):

1. Удалите этот workflow
2. Используйте другие способы из `DEPLOY.md`

---

**Важно:** Для автоматического деплоя нужен токен Vercel! Без него можно использовать:
- **GitHub Pages** (встроенный хостинг)
- **Netlify** (просто подключить GitHub)
- Любой статический хостинг

См. `DEPLOY.md` для всех вариантов.
