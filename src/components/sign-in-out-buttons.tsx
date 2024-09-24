"use client";
import { Loader2Icon } from "lucide-react";
import { signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./ui/button";

export function SignInButton() {
  const [loading, setLoading] = useState(false);

  if (loading) {
    return (
      <Button variant="secondary" disabled>
        <Loader2Icon className="mr-2 animate-spin" /> Cargando
      </Button>
    );
  }

  return (
    <Button
      onClick={async () => {
        setLoading(true);
        try {
          await signIn("google");
        } catch (error) {
          console.error(error);
        }
        setLoading(false);
      }}
    >
      Ingresar con Google
    </Button>
  );
}

export function SignOut() {
  const router = useRouter();

  return (
    <Button
      variant="secondary"
      className="w-full"
      onClick={async () => {
        await signOut();
        router.refresh();
      }}
    >
      Salir
    </Button>
  );
}
