import { getServerAuthSession } from "~/server/auth";
import ProductLayoutComponent from "./layout-component";

export default async function Layout(props: { children: React.ReactNode, params: { code: string } }) {
  const session = await getServerAuthSession();

  if (!session) {
    return null;
  }

  return <ProductLayoutComponent params={props.params} user={session.user}>{props.children}</ProductLayoutComponent>;
}
