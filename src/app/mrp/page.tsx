import Link from "next/link";
import AppSidenav from "~/components/app-sidenav";
import AppLayout from "~/components/applayout";
import { Title } from "~/components/title";
import { Button } from "~/components/ui/button";
import { getServerAuthSession } from "~/server/auth";

export default async function Home() {
  const session = await getServerAuthSession();

  return (
    <AppLayout title={<h1>COMPET MRP</h1>} user={session?.user} sidenav={<AppSidenav />}>
      <Title>Compet MRP</Title>
      <div className="grid w-full max-w-[600px] gap-5">
        <Link href="/mrp/tabla" prefetch>
          <Button className="w-full py-6">Tabla del MRP</Button>
        </Link>
        <Link href="/mrp/cuts" prefetch>
          <Button className="w-full">
            Tabla Recortes
          </Button>
        </Link>
        <Link href="/mrp/forecast" prefetch>
          <Button className="w-full" variant="outline">
            Configuración de forecast
          </Button>
        </Link>

        <Link href="/mrp/datos" prefetch>
          <Button className="w-full" variant="outline">
            Configuración de datos
          </Button>
        </Link>

        <Link href="/mrp/consulta" prefetch>
          <Button className="w-full" variant="outline">
            Consulta de produccion
          </Button>
        </Link>

       
      </div>
    </AppLayout>
  );
}
