import { getServerAuthSession } from "~/server/auth";
import ProductLayoutComponent from "./layout-component";
import { SessionProvider } from "next-auth/react";
import { api } from "~/trpc/server";

export default async function Layout(props: { children: React.ReactNode, params: { code: string } }) {
  const session = await getServerAuthSession();
  const productCode = decodeURIComponent(props.params.code ?? "");
  const product = await api.db.getProductByCode.query({ code: productCode });

  if (!session) {
    return null;
  }

  return <ProductLayoutComponent user={session.user} product={product} code={productCode}>
    <SessionProvider>
      {props.children}
    </SessionProvider>
  </ProductLayoutComponent>;
}
