import { Suspense } from "react";
import MatchesView from "@/components/matches-view";
export default function MatchesPage() {
  return (
    <Suspense fallback={<p>Loading match log…</p>}>
      <MatchesView />
    </Suspense>
  );
}
