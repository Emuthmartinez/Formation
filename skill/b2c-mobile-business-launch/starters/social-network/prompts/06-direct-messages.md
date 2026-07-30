# 06 — Direct Messages (optional)

Keep V1 small: text only, no group chats, no media. Mutual-follow gating is the primary spam control.

```
Build direct messaging between users.

Requirements:
- Start a conversation from any user's profile ("Message" button)
- Conversation list shows all active conversations, sorted by most recent message
- Message thread with real-time delivery using Supabase real-time
- Read receipts (single check = sent, double check = read)
- Only users who follow each other can message (to prevent spam)
- Message notification in nav bar separate from main notifications

Keep it simple for MVP: text only, no group chats, no media in DMs (add later).

Strings: every user-facing label, headline, button, empty state, and error
comes from COPY_DECK.md (author missing rows first — voice from COPY_BRIEF.md,
craft from references/conversion-copy.md), typed via the externalized resource
named in TECH_SPEC.md. Example copy in this prompt is voice guidance, not
shipping strings.
```

## Skill-integration notes

- DMs are the highest-sensitivity data in the product. RLS must restrict read/write to the two participants — add explicit policies and tests to `SECURITY.md`; this is a threat-model item, not a default.
- Enforce the mutual-follow rule **server-side**, not just in the UI. Record it as the anti-spam control.
- Read receipts and unread counts should not block message send — keep delivery on the real-time channel and receipts as a separate async update.
- Add `dm_conversation_started`, `dm_sent`, `dm_read` to `ANALYTICS.md`.
- If the founder later wants media in DMs, route uploads through Supabase Storage with the same moderation gate as posts.
</content>
