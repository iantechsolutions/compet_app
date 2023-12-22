"use client"
import { signIn, signOut } from "next-auth/react";
import { Button } from "./ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2Icon } from "lucide-react";

export function SignInButton() {
    const [loading, setLoading] = useState(false)

    if(loading) {
        return <Button variant="secondary" disabled><Loader2Icon className="animate-spin mr-2" /> Cargando</Button>
    }

    return <Button
        onClick={async () => {
            setLoading(true)
            try {
                await signIn('google')
            } catch (error) {
                console.error(error)
            }
            setLoading(false)
        }}
    >Ingresar con Google</Button>
}

export function SignOut() {
    const router = useRouter()

    return <Button
        variant="secondary"
        className="w-full"
        onClick={async () => {
            await signOut()
            router.refresh()
        }}
    >Salir</Button>
}