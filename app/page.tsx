import type { Metadata } from "next";
import { MicsDashboard } from "./MicsDashboard";

export const metadata: Metadata = {
  title: "MICS Survey Content Dashboard",
  description: "Explore questionnaire content coverage across MICS rounds, regions and countries.",
};

export default function Home() {
  return <MicsDashboard />;
}
