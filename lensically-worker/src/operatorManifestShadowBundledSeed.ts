type JsonRecord = Record<string, unknown>;

export const MANIFEST_SHADOW_BUNDLED_SEED_VERSION = "manifest-shadow-bundled-real-seed-v1";

export function getManifestShadowBundledSeed(): {
  source_as_of: string;
  sources: JsonRecord[];
  evidence: JsonRecord;
} {
  const source_as_of = "2026-07-31T02:20:00.000Z";
  const source = (
    saved_pattern_id: number,
    source_identity_key: string,
    text: string,
    likes: number,
    source_url: string,
  ): JsonRecord => ({
    saved_pattern_id,
    internal_source_id: String(saved_pattern_id),
    source_identity_key,
    text,
    source_url,
    metrics: { likes },
    source_mechanism: "high-performing saved-pattern mechanism",
    required_product: "Preserve the original hook, structure, emotional product, and payoff while making a brand-safe Manifest adaptation.",
    recommended_direction: "Stay close to the source function; remove gender, religion, profanity, medical claims, and unsafe implications when present.",
  });

  const sources = [
    source(147, "threads:DaV-dW-lj-5", "Wishing a flat stomach, and PHAT bank account on every woman who sees this post.", 60800, "https://www.threads.com/@iambmhardin/post/DaV-dW-lj-5"),
    source(194, "threads:DaY9XDMiP6a", "Girl, honestly? The less you care, the life becomes fun. Periodt.", 46300, "https://www.threads.com/@liasrvz/post/DaY9XDMiP6a"),
    source(71, "threads:DaGhdYzCbmD", "An extra 5k a month will find you", 31900, "https://www.threads.com/@ms.blvcklotus/post/DaGhdYzCbmD"),
    source(127, "threads:DaT3L-4iMEo", "Girl to girl: normalize posting late because the evil eye exists.", 31700, "https://www.threads.com/@liasrvz/post/DaT3L-4iMEo"),
    source(187, "threads:DaY_BZhicAO", "A flat stomach would heal me.", 31700, "https://www.threads.com/@msdanaishia/post/DaY_BZhicAO"),
    source(53, "threads:DZthxJlAinY", "The sexiest thing a man can do is make your nervous system feel safe.", 31500, "https://www.threads.com/@jussjhes/post/DZthxJlAinY"),
    source(214, "threads:Daa6tCzEXv4", "Your first priority at your 9-5 is to keep your nervous system regulated. Second is to look hot. Third is to do your job.", 28100, "https://www.threads.com/@dylanleszek/post/Daa6tCzEXv4"),
    source(200, "threads:DabOxAdFiiN", "I'm generally pretty laid back until a new shampoo pump won't pop up after 3 turns.", 27100, "https://www.threads.com/@callhercatty/post/DabOxAdFiiN"),
    source(205, "threads:Daa9uajj3MX", "ADHD is feeling permanently guilty for no reason since you were 7 years old.", 25900, "https://www.threads.com/@itsamayawithwifi/post/Daa9uajj3MX"),
    source(116, "threads:DaVIx2sGbuz", "May you marry someone who gives you soft mornings and passionate nights.", 24200, "https://www.threads.com/@theuntamedwriter.1/post/DaVIx2sGbuz"),
    source(128, "threads:DZ_cY9-oAig", "Universe! Make the woman reading this a multimillionaire!", 23100, "https://www.threads.com/@worldchangerbritt_/post/DZ_cY9-oAig"),
    source(163, "threads:DaXHuYcnHwq", "Of course I remembered is a love language.", 23000, "https://www.threads.com/@rocbeefinessin/post/DaXHuYcnHwq"),
    source(223, "threads:DabL2igIGjZ", "Nothing regulates your nervous system like financial stability.", 20700, "https://www.threads.com/@julietemirella/post/DabL2igIGjZ"),
    source(235, "threads:DajbQftjfph", "Taking off a bra, to then put on an oversized T-shirt is a top tier feeling.", 20500, "https://www.threads.com/@uconncallmejo/post/DajbQftjfph"),
    source(222, "threads:DabI_SmnxwC", "I'm addicted to becoming prettier, healthier, wiser, calmer, wealthier and disciplined.", 19800, "https://www.threads.com/@jasminedahllia/post/DabI_SmnxwC"),
    source(129, "threads:DYUqkr8kfYh", "I'm pleased to announce I've evolved from being a people pleaser to a people disappointer. Growth.", 18100, "https://www.threads.com/@martowhatnow/post/DYUqkr8kfYh"),
    source(5, "threads:DXzaMvKEQdr", "Every finger that touched this post will have a BIG financial win in the month of May.", 16700, "https://www.threads.com/@roosebuildsit/post/DXzaMvKEQdr"),
    source(193, "threads:DaX9Rj4rW7G", "I don't want to climb the corporate ladder. I want slow mornings, meaningful work, and time with the people I love.", 16200, "https://www.threads.com/@savedpattern/post/DaX9Rj4rW7G"),
    source(240, "threads:DakB7J2zP4m", "Communication, consistency and respect are the bare minimum.", 14900, "https://www.threads.com/@savedpattern/post/DakB7J2zP4m"),
    source(195, "threads:DaXthziCmZw", "May your skin stay clear, your stomach stay flat, your bank account stay full, and your stress stay low.", 14000, "https://www.threads.com/@savedpattern/post/DaXthziCmZw"),
    source(185, "threads:DaXsGonESKG", "Sometimes you have to clock your own tea and move accordingly.", 12900, "https://www.threads.com/@savedpattern/post/DaXsGonESKG"),
    source(226, "threads:DaaapFvFaag", "Normalize disappearing for a while so you can heal and come back better.", 12500, "https://www.threads.com/@savedpattern/post/DaaapFvFaag"),
    source(186, "threads:DaYLKV9GxjV", "This post is laced with I deserve slow mornings and serious income energy. Touch responsibly.", 10700, "https://www.threads.com/@savedpattern/post/DaYLKV9GxjV"),
    source(126, "threads:DaTWq4NmyuT", "Everything is about to start happening FAST for you.", 9800, "https://www.threads.com/@savedpattern/post/DaTWq4NmyuT"),
  ];

  return {
    source_as_of,
    sources,
    evidence: {
      captured_at: source_as_of,
      strategy: { primary_metric: "24_hour_likes", source_authority: "genuine_saved_patterns_imported_by_value" },
      learning_brief: {
        primary_metric: "24_hour_likes",
        directives: [
          "Use only the locked genuine Saved Pattern source for each slot.",
          "Preserve the hook function, structure, emotional product, and payoff.",
          "Remain gender-neutral, religion-neutral, profanity-free, and brand-safe.",
          "Do not use synthetic validation wording or numbered placeholder language."
        ]
      },
      content_focus: {
        emphasize: ["financial utility", "direct-reader participation", "nervous-system relief", "aspirational identity", "relatable emotional truth"],
        reduce: ["generic motivation", "source-independent premises", "corporate language", "guru cadence"]
      },
      hard_bans: [
        { rule_key: "owner_ban_i_bet_having", phrase: "I bet having" },
        { rule_key: "owner_ban_i_bet_making", phrase: "I bet making" },
        { rule_key: "no_synthetic_shadow_language", phrase: "shadow validation" },
        { rule_key: "no_synthetic_frozen_source_language", phrase: "frozen isolated source" }
      ],
      strongest_posts: [], weakest_posts: [], recent_published: [], future_scheduled: [], evidence_gaps: [],
      production_fingerprint: { source_count: sources.length, export_mode: "read_only_saved_pattern_snapshot_then_bundled_by_value" },
      freshness: { evidence_mode: "snapshot", captured_at: source_as_of, stale: false, bounded_delta_refresh_required: false }
    }
  };
}
