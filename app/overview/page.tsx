import { redirect } from "next/navigation";

/** The overview is now Scotty's home; keep old links working. */
export default function OverviewRedirect() {
  redirect("/");
}
