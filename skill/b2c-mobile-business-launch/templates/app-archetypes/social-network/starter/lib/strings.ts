// Every user-facing string in the starter lives here, keyed the way COPY_DECK.md
// keys the product's words — the key here becomes the localization key later.
// The copy pass replaces these values from the deck; when localizing, lift this
// module into the stack's resource format (next-intl messages, i18next resources).
// "Wrenfeed" is a fictional example brand and is gate-detectable: check:app-copy
// fails a build that ships it.
export const strings = {
  landing: {
    headline: "Your people, in one place",
    body: "Wrenfeed is a calm feed for the people you already know.",
    signIn: "Sign in",
    feed: "Feed",
  },
  meta: {
    title: "Wrenfeed — your people's feed",
    description: "A calm feed for the people you already know.",
  },
} as const;
