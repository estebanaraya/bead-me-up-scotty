"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, FolderCog, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FolderBrowserModal } from "@/components/folder-browser-modal";
import { boardHref } from "@/components/home/tile-parts";
import type { Tile } from "@/lib/overview";

/** The project picker, adding and managing projects, now that the launcher is not the front door. */
export function ProjectsMenu({ projects }: { projects: Pick<Tile, "id" | "name">[] }) {
  const router = useRouter();
  const [addOpen, setAddOpen] = React.useState(false);
  const sorted = [...projects].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
          Projects
          <ChevronsUpDown className="text-[var(--text-3)]" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[220px]">
          {projects.length > 0 && <DropdownMenuLabel>Open a board</DropdownMenuLabel>}
          {sorted.map((p) => (
            <DropdownMenuItem key={p.id} onClick={() => router.push(boardHref(p.id))}>
              <span className="truncate">{p.name}</span>
            </DropdownMenuItem>
          ))}
          {projects.length > 0 && <DropdownMenuSeparator />}
          <DropdownMenuItem onClick={() => setAddOpen(true)}>
            <Plus size={14} aria-hidden />
            <span>Add project…</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/projects")}>
            <FolderCog size={14} aria-hidden />
            <span>Manage projects</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <FolderBrowserModal open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}
