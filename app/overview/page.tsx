import type { Metadata } from "next";
import { OverviewView } from "@/components/overview-view";
import { projectTitle } from "@/lib/app-title";

export const metadata: Metadata = { title: projectTitle("Overview") };

export default function OverviewPage() {
  return <OverviewView />;
}
