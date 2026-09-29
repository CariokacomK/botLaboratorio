# Bot de horários

Script em Node.js que lê o horário de laboratório da turma no portal da Unicesumar e manda o resumo do dia para um chat do Telegram.

## Subir

```bash
cp .env.example .env
npm install
npm start
```

Preencha no `.env`:

```
TELEGRAM_TOKEN=
TELEGRAM_CHAT_ID=
TIMEZONE=America/Sao_Paulo
```
