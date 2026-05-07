import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NewsItem {
  title: string;
  source: string;
  link: string;
  pubDate: string;
}

interface DogNewsReport {
  telegramMessage: string;
  itemCount: number;
  date: string;
}

// ─── RSS sources (Google News, no API key needed) ─────────────────────────────

const RSS_QUERIES = [
  "chiens actualités santé",
  "chiens comportement tendances",
  "animaux compagnie saison conseils",
];

function buildGoogleNewsUrl(query: string): string {
  const q = encodeURIComponent(query);
  return `https://news.google.com/rss/search?q=${q}&hl=fr&gl=CH&ceid=CH:fr`;
}

// ─── RSS parser (zero-dependency, regex-based) ────────────────────────────────

function parseRSSItems(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;

  while ((m = itemRe.exec(xml)) !== null) {
    const chunk = m[1] ?? "";

    const titleMatch =
      chunk.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ??
      chunk.match(/<title>([\s\S]*?)<\/title>/);
    const title = (titleMatch?.[1] ?? "").trim().replace(/&amp;/g, "&").replace(/&quot;/g, '"');

    // Google News RSS puts source name in <source> or appended to title after " - "
    const sourceMatch =
      chunk.match(/<source[^>]*>([\s\S]*?)<\/source>/) ??
      chunk.match(/<dc:creator>([\s\S]*?)<\/dc:creator>/);
    const source = (sourceMatch?.[1] ?? title.split(" - ").pop() ?? "").trim();

    const linkMatch = chunk.match(/<link>([\s\S]*?)<\/link>/);
    const link = (linkMatch?.[1] ?? "").trim();

    const dateMatch = chunk.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const pubDate = (dateMatch?.[1] ?? "").trim();

    if (title) {
      // Strip source suffix from title (Google News appends " - Source")
      const cleanTitle = title.includes(" - ")
        ? title.slice(0, title.lastIndexOf(" - ")).trim()
        : title;

      items.push({ title: cleanTitle, source, link, pubDate });
    }
  }

  return items;
}

// ─── Fetch news from all RSS sources ─────────────────────────────────────────

async function fetchDogNews(): Promise<NewsItem[]> {
  const allItems: NewsItem[] = [];
  const seenTitles = new Set<string>();

  for (const query of RSS_QUERIES) {
    try {
      const url = buildGoogleNewsUrl(query);
      const res = await fetch(url, {
        headers: { "User-Agent": "DogShift-NewsAgent/1.0" },
        signal: AbortSignal.timeout(8_000),
      });

      if (!res.ok) continue;

      const xml = await res.text();
      const items = parseRSSItems(xml).slice(0, 5);

      for (const item of items) {
        const key = item.title.toLowerCase().slice(0, 60);
        if (!seenTitles.has(key)) {
          seenTitles.add(key);
          allItems.push(item);
        }
      }
    } catch {
      // One failing feed should not abort the whole run
    }
  }

  return allItems.slice(0, 12);
}

// ─── Claude synthesis ─────────────────────────────────────────────────────────

const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

async function synthesizeWithClaude(items: NewsItem[], today: Date): Promise<string> {
  const day = today.getDate();
  const month = MONTHS_FR[today.getMonth()];
  const year = today.getFullYear();
  const dateStr = `${day} ${month} ${year}`;

  const newsSummary = items
    .map((it, i) => `${i + 1}. ${it.title}${it.source ? ` (${it.source})` : ""}`)
    .join("\n");

  const { text } = await generateText({
    model: anthropic("claude-3-5-haiku-20241022"),
    messages: [
      {
        role: "user",
        content: `Tu es l'assistant contenu de DogShift, une marketplace suisse de garde de chiens.
Aujourd'hui c'est le ${dateStr}.

Voici les actualités canines et animaux du jour trouvées sur le web :

${newsSummary}

Génère un message Telegram en français avec EXACTEMENT ce format (utilise les emojis) :

🐾 *DogShift News — ${dateStr}*

🗞️ *Actualités du jour*
• [Résume l'actualité la plus pertinente en 1-2 phrases, inclure l'info clé]
• [Deuxième actualité pertinente, 1-2 phrases]
• [Troisième actualité pertinente, 1-2 phrases]

🌿 *Focus ${month}*
[Un conseil saisonnier concret pour les propriétaires de chiens en ${month} — parasites, chaleur, météo, etc. 2-3 phrases maximum]

📱 *3 idées de posts réseaux sociaux*
1️⃣ [Idée de post inspirante ou éducative liée à l'actualité ou à la saison — ton DogShift : chaleureux, expert, suisse]
2️⃣ [Idée de post avec un angle "astuce pratique" ou "fun fact" sur les chiens]
3️⃣ [Idée de post qui valorise les pet-sitters ou crée de l'engagement avec la communauté]

_Généré automatiquement par DogShift NewsAgent · ${dateStr}_

Génère UNIQUEMENT le message Telegram, sans aucun texte avant ou après.`,
      },
    ],
  });

  return text.trim();
}

// ─── Telegram delivery ────────────────────────────────────────────────────────

async function sendTelegram(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN_NEWS ?? process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID_NEWS ?? process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    throw new Error("TELEGRAM_BOT_TOKEN_NEWS ou TELEGRAM_CHAT_ID_NEWS manquant dans les variables d'environnement");
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: "Markdown",
      disable_web_page_preview: false,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Telegram API error ${res.status}: ${err}`);
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function runDogNewsAgent(): Promise<DogNewsReport> {
  const today = new Date();

  // 1. Fetch news from RSS feeds
  const items = await fetchDogNews();

  if (items.length === 0) {
    throw new Error("Aucune actualité récupérée depuis les flux RSS");
  }

  // 2. Synthesize with Claude
  const telegramMessage = await synthesizeWithClaude(items, today);

  // 3. Send to Telegram
  await sendTelegram(telegramMessage);

  return {
    telegramMessage,
    itemCount: items.length,
    date: today.toISOString(),
  };
}
