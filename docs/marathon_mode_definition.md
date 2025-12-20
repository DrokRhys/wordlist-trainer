## Marathon mode reconstruction prompt

Use this prompt to rebuild the Marathon mode behavior if it ever regresses.

> Implement Marathon test dots and flow exactly like this:
> - Load all words for the selected unit/section (shuffled) but keep their loaded order to assign dots.
> - Keep a per-word state with `status` (`empty`, `mistake`, `unknown`, `correct`), `attempts`, and `slotIndex` (null until first use). Keep refs for these maps so selection logic never uses stale state.
> - Visual dots: create as many empty dots as there are words. When a word is asked the first time, assign it the next free dot from left to right (`slotIndex = nextSlotRef`, then increment the ref). Subsequent repeats reuse the same dot, recoloring it based on the latest result. Highlight the dot of the current question.
> - Question selection:
>   1) Always ask every `empty` word before repeating any word. Use the loaded order to pick the next unseen word so dots advance left to right even if answers are wrong.
>   2) After all words are seen once, pick by weight: `mistake|unknown` weight 20, `empty` 10, `correct` 1. Skip words that are `correct` with `attempts >= 3`. Avoid immediate repetition: if more than one candidate exists, drop the previous word from the candidate list.
> - Answer handling: normalize inputs (lowercase, trim, collapse spaces, strip punctuation), expand variants (slashes, parentheses), allow small typos via Levenshtein (<=1 for short, <=2 for long). Results: `correct`, `wrong`, `unknown` (for skip). Update per-word `attempts` and `status`, recolor its dot accordingly. Mistakes list records both `wrong` and `unknown`.
> - Finishing: when all words are `correct`, mark finished and save history with type `marathon`, score = total words, total = attempts, mistakes = IDs of mistakes.
> - UI expectations: dots start light gray, current dot is slightly larger with a border; correct = green, wrong = light red, unknown/skip = light orange; active dot highlights even when status is still empty.

Key pitfalls to avoid:
- Do not derive `nextSlotRef` from `slots.length` state during first pick (state may still be empty); use the known words length or a dedicated ref.
- Ensure first `pickNext` sees the loaded words via refs (not yet-updated React state), otherwise the “visit all unseen words first” pass fails and dots won’t advance.
