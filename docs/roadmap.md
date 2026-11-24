# Roadmap

Features planned beyond the MVP:

1. **Discord Webhook Alerts**: Implement `DiscordNotifier` in `functions/lib/notify/discord.ts` (replacing `NoopNotifier`) to post embeds when `bgovph_incidents` open or resolve, with optional per-category webhook routing.
2. **Additional Check Types**: Keyword content verification, TLS certificate expiry warnings, DNS resolution via DoH, and TCP port checks.
3. **APAC-Pinned Probes**: Use a Cloudflare Durable Object with `locationHint: "apac"` to minimize false positives from distant PoPs.
4. **Live Updates**: Stream status changes to the frontend via Supabase Realtime or WebSockets.
