import AppSidenav from "~/components/app-sidenav";
import AppLayout from "~/components/applayout";
import type { NavUserData } from "~/components/nav-user-section";
import { Title } from "~/components/title";
import { ProductProvider } from "./product_provider";
import { api } from "~/trpc/server";
import { SessionProvider } from "next-auth/react";

export default async function ProductLayoutComponent(props: { children: React.ReactNode; user: NavUserData, params: { code: string } }) {
  const productCode = decodeURIComponent(props.params.code ?? "");
  let product = null;

  try {
    product = await api.db.getProductByCode.query({ code: productCode })
  } catch (e) {
    console.debug(e);
  }

  if (!product) {
    return (
      <AppLayout title={<h1>Error 404</h1>} user={props?.user} sidenav={<AppSidenav />}>
        <Title>No se encontró el pedido</Title>
        <p>No encontramos ningún producto con el número "{productCode}".</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title={
        <div>
          <h1>{product.description}</h1>
          <p className="text-sm">{product.code}</p>
        </div>
      }
      user={props?.user}
      sidenav={<AppSidenav />}
    >
      <SessionProvider>
        <ProductProvider product={product}>{props.children}</ProductProvider>
      </SessionProvider>
    </AppLayout>
  );
}
