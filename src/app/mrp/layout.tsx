import { cookies } from "next/headers";

import { TRPCReactProvider } from "~/trpc/react";
import AuthProvider from "~/components/auth-provider";
import MRPDataProvider from "~/components/mrp-data-provider";

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <TRPCReactProvider cookies={cookies().toString()}>
        <MRPDataProvider>
          {props.children}
        </MRPDataProvider>
      </TRPCReactProvider>
    </AuthProvider>
  );
}
