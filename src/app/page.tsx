import { HomePageClient } from "@/components/HomePageClient";
import { CapacitorDeepLinkRedirect } from "@/components/CapacitorDeepLinkRedirect";

export default function HomePage() {
  return (
    <>
      <CapacitorDeepLinkRedirect />
      <HomePageClient />
    </>
  );
}
