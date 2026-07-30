# Variant — Voice-First

Apply after the text base. Turns the product into a voice-in / voice-out conversation. Voice changes the latency budget, adds audio storage and cost, and needs a different UI.

```
Modify the chat for a voice-first conversation.

Changes from the text version:
- Voice input: capture microphone audio and transcribe it to text
  (speech-to-text) before sending to the model
- Voice output: synthesize the assistant's response to speech (text-to-speech)
  and play it back, while also showing the text
- A voice-first UI: a talk/tap-to-speak control, a clear listening/thinking/
  speaking state, and a transcript view
- Low latency: stream the model response and start TTS on the first sentence so
  playback begins before the full response is ready
- Store audio in Supabase Storage (or stream it) with the same per-user RLS;
  store the transcript as the message text
- Graceful fallback to text when the mic is unavailable or transcription fails

Pick STT and TTS providers and tell me the trade-offs (latency, cost, quality);
keep provider choices in config.
```

## Skill-integration notes

- STT/TTS are paid, account-gated providers — record the choice and cost assumptions in `TOOL_DECISIONS.md` and route keys through `SECRETS.md`. Voice is materially more expensive than text; revisit usage caps (prompt 06) accordingly.
- The listening/thinking/speaking states must honor reduced-motion and provide a text fallback for accessibility (`design-visual-system.md`). Latency is the make-or-break UX — the first-sentence TTS streaming is the 11-star moment (`eleven-star-experience.md`).
- Audio is sensitive PII; document capture, retention, and deletion in `privacy-terms.md` and apply the same RLS/owner-only rules as messages.
- Add `voice_input_started`, `transcription_completed`, `tts_playback_started`, `voice_fallback_to_text` to `ANALYTICS.md`.
</content>

## Strings

Every label, headline, button, empty state, and error a user reads comes from `COPY_DECK.md` — author missing rows first (voice from `COPY_BRIEF.md`, craft from `references/conversion-copy.md`), then type the rows into the externalized string resource named in `TECH_SPEC.md`. Example copy in this prompt is voice guidance, not shipping strings; `check:app-copy` gates the result.
