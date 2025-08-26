import 'dotenv/config';
import axios from 'axios';
import * as cheerio from 'cheerio';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

const TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TZ = process.env.TIMEZONE || 'America/Sao_Paulo';

dayjs.extend(utc);
dayjs.extend(timezone);

function todayStr() {
  return dayjs().tz(TZ).format('YYYY-MM-DD');
}

function buildUrl(dateStr) {
  return `https://app.unicesumar.edu.br/presencial/forms/informatica/horario.php?dados=${dateStr}%7CN`;
}

async function fetchSchedule(dateStr) {
  const url = buildUrl(dateStr);
  const { data } = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  return data;
}

function parseADSIS(html, turma = 'ADSIS4S-N-B') {
  const $ = cheerio.load(html);
  const results = [];

  $('table.tableReserva').each((_, table) => {
    const lab = $(table).find('tr').first().text().trim();
    const reservas = $(table).find('div.reserva');

    reservas.each((idx, r) => {
      const text = $(r).text().trim().toUpperCase();
      if (text.includes(turma.toUpperCase())) {
        const horario = idx === 0 ? '1º Horário' : '2º Horário';
        results.push(`${horario} · ${lab} · ${$(r).text().trim()}`);
      }
    });
  });

  return results;
}

async function sendTelegramMessage(text) {
  const url = `https://api.telegram.org/bot${TOKEN}/sendMessage`;
  await axios.post(url, {
    chat_id: CHAT_ID,
    text,
    parse_mode: 'Markdown'
  });
}

async function jobRun() {
  const dateStr = todayStr();
  const html = await fetchSchedule(dateStr);
  const matches = parseADSIS(html, 'ADSIS4S-N-B');

  let msg = `📅 *${dateStr}* · Turno Noite\n📚 Turma ADSIS4S-N-B\n\n`;
  msg += matches.length
    ? matches.map(m => `• ${m}`).join('\n')
    : 'Nenhuma aula encontrada hoje.';

  await sendTelegramMessage(msg);
  console.log(msg);
}

if (process.argv.includes('--now')) {
  jobRun();
}
