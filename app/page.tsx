import type { Metadata } from "next";
import { HomeView } from "@/components/home/home-view";
import { projectTitle } from "@/lib/app-title";

export const metadata: Metadata = { title: projectTitle("Overview") };

export default function Page() {
  return <HomeView />;
}
