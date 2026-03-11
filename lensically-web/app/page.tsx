import type { Metadata } from "next";
import HomePageClient from "./HomePageClient";

export const metadata: Metadata = {
  title: "Lensically | Threads Analytics and Workflow Support",
  description:
    "Lensically is a public Threads analytics and workflow platform homepage with direct links to privacy and data deletion disclosures.",
};

export default function Home() {
  return <HomePageClient />;
}
