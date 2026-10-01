import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { countUnhashed, getDuplicateGroups } from "@/lib/duplicates";
import { AdminPageHeader } from "../../_components/fields";
import { DuplicateGroups } from "./duplicate-groups";

export const metadata: Metadata = { title: "Duplicates" };

export default async function AdminDuplicatesPage() {
  await requireAdminPage();
  const [groups, unhashed] = await Promise.all([getDuplicateGroups(), countUnhashed()]);
  return (
    <>
      <AdminPageHeader
        breadcrumb={<Link href="/admin/media">Media library /</Link>}
        title="Duplicates"
        description="Files that are in the library more than once: the very same file, or photos that look the same (resized or re-saved copies). Keep one and the others are swapped for it everywhere they're used, then deleted."
      />
      <DuplicateGroups groups={groups} unhashed={unhashed} />
    </>
  );
}
