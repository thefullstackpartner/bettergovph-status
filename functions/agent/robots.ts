import { type AppContext, getSiteUrl } from './site';

/**
 * AI crawler policy: block bots that collect content for model *training*;
 * allow bots that fetch pages live to answer a user's question (retrieval /
 * AI search). Regular search engines fall under `User-agent: *`.
 */
export const AI_TRAINING_CRAWLERS = [
  'GPTBot', // OpenAI training
  'ClaudeBot', // Anthropic training
  'anthropic-ai', // Anthropic (legacy token)
  'Google-Extended', // Gemini / Vertex AI training (does not affect Google Search)
  'Applebot-Extended', // Apple Intelligence training (does not affect Applebot search)
  'CCBot', // Common Crawl (widely used for training)
  'Bytespider', // ByteDance
  'Meta-ExternalAgent', // Meta AI training
  'FacebookBot', // Meta speech/LLM training
  'cohere-training-data-crawler', // Cohere training
  'Diffbot',
  'AI2Bot', // Allen Institute training
  'omgili', // Webz.io training data
  'Timpibot',
];

export const AI_RETRIEVAL_AGENTS = [
  'ChatGPT-User', // ChatGPT fetching a page for a user
  'OAI-SearchBot', // ChatGPT search
  'Claude-User', // Claude fetching a page for a user
  'Claude-SearchBot', // Claude search
  'PerplexityBot', // Perplexity answer engine index
  'Perplexity-User', // Perplexity fetching a page for a user
  'DuckAssistBot', // DuckDuckGo AI answers
  'MistralAI-User', // Le Chat fetching a page for a user
];

export function buildRobotsTxt(site: string): string {
  const allowGroups = AI_RETRIEVAL_AGENTS.map(
    (ua) => `User-agent: ${ua}\nAllow: /\nDisallow: /api/trigger`
  ).join('\n\n');
  const blockGroups = AI_TRAINING_CRAWLERS.map(
    (ua) => `User-agent: ${ua}\nDisallow: /`
  ).join('\n\n');

  return `# BetterGovPH Status — robots.txt
# Public-interest uptime data for Philippine government websites.
# Search engines and AI assistants answering users' questions are welcome.
# Collecting this content for AI model training is not permitted.
# LLM-friendly index: ${site}/llms.txt

# Content Signals (https://contentsignals.org)
Content-Signal: search=yes, ai-input=yes, ai-train=no

User-agent: *
Allow: /
Disallow: /api/trigger

# --- AI assistants fetching pages on behalf of a user: allowed ---

${allowGroups}

# --- AI training crawlers: blocked ---

${blockGroups}

Sitemap: ${site}/sitemap.xml
`;
}

export function onRobotsTxtRequest(c: AppContext) {
  return c.body(buildRobotsTxt(getSiteUrl(c)), 200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'public, max-age=3600, s-maxage=3600',
  });
}
