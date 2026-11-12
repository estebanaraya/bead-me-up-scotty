import type { Metadata } from "next";
import { Launcher } from "@/components/launcher";
import { projectTitle } from "@/lib/app-title";

export const metadata: Metadata = { title: projectTitle("Projects") };

export default function ProjectsPage() {
  return <Launcher />;
}
