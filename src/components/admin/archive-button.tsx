"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ArchiveButton({ candidateId }: { candidateId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="danger"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const response = await fetch("/api/admin/candidates/archive", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ candidateIds: [candidateId] })
          });

          if (response.ok) {
            router.push("/admin/candidates/archived");
            router.refresh();
          }
        })
      }
    >
      Archiver
    </Button>
  );
}
