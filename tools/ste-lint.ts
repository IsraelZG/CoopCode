import * as fs from 'fs';
import * as path from 'path';

const MARKETING = [
  "seamless", "seamlessly", "robust", "powerful", "cutting-edge", "effortless", "effortlessly",
  "world-class", "next-generation", "revolutionary", "blazing", "lightning-fast", "elegant", "delightful",
  "turnkey", "best-in-class", "state-of-the-art", "game-changing", "first-class", "battle-tested",
  "enterprise-grade", "supercharge", "unlock", "unleash", "empower", "empowers"
];

const BANNED = [
  "begin", "begins", "commence", "commences", "initiate", "initiates", "originate",
  "utilize", "utilizes", "utilizing", "leverage", "leverages", "leveraging", "facilitate", "facilitates",
  "ensure", "ensures", "ensuring", "prior to", "subsequent to", "obtain", "obtains", "acquire", "acquires",
  "demonstrate", "demonstrates", "additionally", "furthermore", "moreover", "comprehensive", "comprehensively",
  "utilization", "aforementioned", "henceforth", "therein", "whilst", "amongst", "numerous", "myriad", "plethora",
  "in order to", "a variety of", "in the event that", "due to the fact that", "it is important to note"
];

const PHRASAL = [
  "spin up", "spin down", "reach out", "dive into", "dives into", "diving into", "kick off", "kicks off",
  "roll out", "rolls out", "tear down", "ramp up", "circle back", "drill down", "spun up", "reaching out"
];

const MODAL_HEDGE = [
  "it is important to note", "it should be noted", "it is worth noting", "please note that",
  "as mentioned", "as noted above"
];

const BE = "(?:am|is|are|was|were|be|been|being)";
const PP_IRREG = "(?:done|made|sent|read|built|kept|held|set|put|run|written|shown|given|taken|found|got|gotten|seen|known|thrown|drawn)";

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripCode(t: string): string {
  t = t.replace(/```[\s\S]*?```/g, " ");
  t = t.replace(/`[^`]*`/g, " ");
  return t;
}

function sentences(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split('\n')) {
    let s = line.trim();
    if (!s) continue;
    s = s.replace(/^\s*#{1,6}\s*/, '');
    s = s.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '');
    if (!s) continue;
    const parts = s.split(/(?<=[.!?:])\s+(?=[A-Z0-9"'\-])/);
    for (const p of parts) {
      const trimmed = p.trim();
      if (trimmed) out.push(trimmed);
    }
  }
  return out;
}

function wc(s: string): number {
  const matches = s.match(/[A-Za-z0-9][A-Za-z0-9'\-/]*/g);
  return matches ? matches.length : 0;
}

function countCi(text: string, phrases: string[]): { n: number; hits: string[] } {
  let n = 0;
  const hits: string[] = [];
  for (const ph of phrases) {
    const regex = new RegExp(`(?<![a-zA-Z])${escapeRegex(ph)}(?![a-zA-Z])`, 'gi');
    const matches = text.match(regex);
    if (matches) {
      n += matches.length;
      hits.push(ph);
    }
  }
  return { n, hits };
}

export function lint(text: string) {
  const raw = text;
  const strippedText = stripCode(text);
  const sents = sentences(strippedText);
  const words = sents.reduce((acc, s) => acc + wc(s), 0) || 1;

  const longs = sents.map(s => ({ count: wc(s), sentence: s })).filter(item => item.count > 20);

  const passiveRegex = new RegExp(`\\b${BE}\\s+(?:\\w+ed|${PP_IRREG})\\b`, 'gi');
  const ingRegex = new RegExp(`\\b${BE}\\s+\\w+ing\\b`, 'gi');
  const nominalizationRegex1 = /\b(?:perform(?:s|ed)?|conduct(?:s|ed)?|provide(?:s|d)?|carry out|carries out|make use of|makes use of)\b/gi;
  const nominalizationRegex2 = /\b\w{4,}(?:tion|ment|ance|ence)\s+of\b/gi;
  const contractionRegex = /\b\w+[''](?:t|re|ve|ll|d|s|m)\b/g;

  const phrasal = countCi(strippedText, PHRASAL);
  const banned = countCi(strippedText, BANNED);
  const marketing = countCi(strippedText, MARKETING);
  const modalHedge = countCi(strippedText, MODAL_HEDGE);

  const paras = raw.split(/\n\s*\n/).filter(p => p.trim());
  const longParagraphs = paras.filter(p => sentences(stripCode(p)).length > 6).length;

  const emDashCount = (raw.match(/—|--/g) || []).length;

  const violations: Record<string, number> = {
    "long_sentence(>20w)": longs.length,
    "semicolon": (strippedText.match(/;/g) || []).length,
    "contraction": (strippedText.match(contractionRegex) || []).length,
    "passive_voice": (strippedText.match(passiveRegex) || []).length,
    "ing_main_verb": (strippedText.match(ingRegex) || []).length,
    "nominalization": (strippedText.match(nominalizationRegex1) || []).length + (strippedText.match(nominalizationRegex2) || []).length,
    "phrasal_verb": phrasal.n,
    "banned_word": banned.n,
    "marketing_adjective": marketing.n,
    "modal_hedge": modalHedge.n,
    "long_paragraph(>6s)": longParagraphs
  };

  const total = Object.values(violations).reduce((a, b) => a + b, 0);

  return {
    words,
    sentences: sents.length,
    violations,
    total,
    total_per100w: Number((total * 100.0 / words).toFixed(2)),
    "em_dash(slop-marker)": emDashCount,
    longest_sentence_words: longs.length > 0 ? Math.max(...longs.map(l => l.count)) : Math.max(...sents.map(s => wc(s)), 0),
    sample_marketing: Array.from(new Set(marketing.hits)).slice(0, 6),
    sample_banned: Array.from(new Set(banned.hits)).slice(0, 6)
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    let input = '';
    process.stdin.on('data', chunk => input += chunk);
    process.stdin.on('end', () => {
      console.log(JSON.stringify(lint(input), null, 2));
    });
  } else {
    for (const filePath of args) {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const res = lint(content);
        const filename = path.basename(filePath).padEnd(32);
        console.log(`${filename} words=${String(res.words).padStart(4)} total=${String(res.total).padStart(3)} per100w=${res.total_per100w.toFixed(2).padStart(6)} em_dash=${res["em_dash(slop-marker)"]}`);
      } else {
        console.error(`File not found: ${filePath}`);
      }
    }
  }
}
