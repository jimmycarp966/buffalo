"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Activity } from "lucide-react";
import { AfipTestModal } from "./AfipTestModal";

export function AfipTestButton() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setModalOpen(true)}
        className="gap-2"
      >
        <Activity className="h-4 w-4" />
        Test AFIP
      </Button>

      <AfipTestModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}

