import Link from "next/link";
import { strings } from "@/lib/strings";

// Landing stub. The real landing page is owned by the launch funnel lane
// (geo-seo.md + landing checks); this exists so the app boots end to end.
// Words come from lib/strings.ts, which the copy pass fills from COPY_DECK.md.
export default function Home() {
  return (
    <main>
      <h1>{strings.landing.headline}</h1>
      <p>{strings.landing.body}</p>
      <p>
        <Link href="/login">{strings.landing.signIn}</Link> · <Link href="/chat">{strings.landing.chat}</Link>
      </p>
    </main>
  );
}
