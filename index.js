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

function weekdayNamePt(dateStr) {
  const idx = dayjs.tz(dateStr, TZ).day();
  return ['DOMINGO','SEGUNDA','TERÇA','QUARTA','QUINTA','SEXTA','SÁBADO'][idx];
}

function parseADSIS(html, turma = 'ADSIS4S-N-B', dateStr) {
  const $ = cheerio.load(html);
  const results = [];

  const RULES = [
    { re: /ELIEL\s+NASCIMENTO/i, allows: [{ day: 'SEGUNDA', slot: '1' }, { day: 'QUINTA', slot: '2' }] },
    { re: /JO(ÃO|AO)\s+CHOMA/i,  allows: [{ day: 'QUARTA',  slot: '1' }, { day: 'QUINTA', slot: '1' }] },
    { re: /JO(ÃO|AO)\s+BIAZOTTO/i,allows: [{ day: 'SEGUNDA', slot: '2' }, { day: 'TERÇA',  slot: '2' }] },
    { re: /CARLOS\s+LUZ/i,       allows: [{ day: 'TERÇA',   slot: '1' }, { day: 'QUARTA', slot: '2' }] },
  ];

  const diaSemana = weekdayNamePt(dateStr);

  $('table.bloco').each((_, blocoTable) => {
    const bloco = $(blocoTable).find('th').first().text().trim();

    $(blocoTable).find('table.tableReserva').each((_, table) => {
      const lab = $(table).find('tr').first().text().trim();
      const reservas = $(table).find('div.reserva');

      reservas.each((idx, r) => {
        const slotNumero = idx === 0 ? '1' : '2';
        const horarioLabel = slotNumero === '1' ? '1º Horário' : '2º Horário';

        const firstLineHtml = (($(r).html() || '').split('<br>')[0] || '');
        const professor = firstLineHtml.replace(/<[^>]+>/g, '').trim();
        const professorUpper = professor.toUpperCase();

        const textUpper = $(r).text().trim().toUpperCase();

        const isTurmaInLab =
          textUpper.includes(turma.toUpperCase()) &&
          /LAB/.test(lab.toUpperCase());

        const bateRegraProf = RULES.some(rule =>
          rule.re.test(professorUpper) &&
          rule.allows.some(a => a.day === diaSemana && a.slot === slotNumero)
        );

        if (isTurmaInLab || bateRegraProf) {
          results.push(`${bloco} · ${horarioLabel} · ${lab} · ${professor}`);
        }
      });
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
  const matches = parseADSIS(html, 'ADSIS4S-N-B', dateStr);

  const sorted = matches.sort((a, b) => {
    const getSlot = (s) => (s.includes('1º Horário') ? 1 : 2);
    return getSlot(a) - getSlot(b);
  });

  let msg = `📅 *${dateStr}* · Turno Noite\n📚 Turma ADSIS4S-N-B\n\n`;
  msg += sorted.length
    ? sorted.map(m => `• ${m}`).join('\n')
    : 'Nenhuma aula encontrada hoje.';

  await sendTelegramMessage(msg);
}


if (process.argv.includes('--now')) {
  jobRun();
}
