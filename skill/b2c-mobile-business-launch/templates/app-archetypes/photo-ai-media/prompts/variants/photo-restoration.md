# Variant — Photo Restoration

Apply after the base. Slims the product to a single-image enhance/restore utility: upload a damaged, blurry, or faded photo → get a restored version. No prompts, no styles, no identity training — one input, one transformation, one reveal. The simplest shape in the category and deliberately **essentials-scope friendly**: it pairs with `launch_scope: lite` when the founder wants a focused utility instead of a studio.

```
Slim the generation product into a single-purpose photo restoration utility.

Changes from the base:
- One flow: upload → restore → before/after reveal → download. No prompt
  input, no preset browsing; at most a small fixed set of modes (restore /
  colorize / upscale) as simple toggles
- The before/after slider IS the product: make the reveal the center of the
  detail view, defaulting to a draggable comparison against the original
- Single-generation pipeline: each restore is one generations row through the
  provider adapter with fixed parameters per mode; no re-roll spirals — the
  retry action exists for failures, and "try a different mode" is the only
  variation
- Keep the upload screening and output screening from the safety layer; the
  consent question simplifies (old family photos: the uploader attests they
  have the right to the photo) but does not disappear
- Pricing fits the utility shape: a small free allowance, then simple credit
  packs; watermark-free and full-resolution download as the paid unlock
- Cut everything the utility does not need from the UI: no studio chrome, no
  feed — library, restore, account
```

## Skill-integration notes

- This is the variant to suggest when the founder's request and budget point at `launch_scope: lite`: fewest systems (prompts 00–04 + 08, with 06 in its simplest pack form), fastest path to the wow moment, and the easiest store-review story. Record the tier in `PROJECT_STATE.yaml`.
- The fixed-parameter, no-re-roll design *lowers* the Variable Reward exposure — say so in the ethics artifact rather than skipping the card: the reveal is still emotionally engineered (family photos cut deep) and still needs its attestation, escape hatch, and honest progress per `ethics-guardrail.md`.
- Old family photos are often of deceased or non-consenting relatives; keep the rights attestation from prompt 08 in its simplified form and the takedown path intact (`privacy-terms.md`).
- Sharing restored family photos is a strong organic loop — the prompt 07 before/after share formats apply unchanged if the founder selects sharing.
- Keep the four lane events (`media_uploaded`, `generation_started`, `generation_completed`, `media_shared`) plus `restore_mode_selected` in `ANALYTICS.md`.
