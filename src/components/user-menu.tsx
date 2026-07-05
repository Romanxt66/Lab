"use client";

import * as React from "react";
import { LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/modules/auth/actions";

export function UserMenu({
  email,
  name,
}: {
  email: string;
  name: string | null;
}) {
  const [pending, setPending] = React.useState(false);

  return (
    <div className="flex items-center gap-2">
      <span className="hidden items-center gap-1.5 text-sm text-muted-foreground sm:flex">
        <User className="size-3.5" />
        {name || email}
      </span>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
        disabled={pending}
        onClick={() => {
          setPending(true);
          void logoutAction();
        }}
      >
        <LogOut />
      </Button>
    </div>
  );
}
