import { cookies } from "next/headers";

import { TRPCReactProvider } from "~/trpc/react";
import AuthProvider from "~/components/auth-provider";
import MRPDataProvider from "~/components/mrp-data-provider";
import { FocusProvider } from "./tabla/focused_provider";
import dayjs from 'dayjs'
import 'dayjs/locale/es'
dayjs.locale('es')

export const metadata = {
  title: "Compet MRP",
  icons: [{ rel: "icon", url: "/icon.png" }],
};


export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <TRPCReactProvider cookies={cookies().toString()}>
        <MRPDataProvider>
          <FocusProvider>
            {props.children}
          </FocusProvider>
        </MRPDataProvider>
      </TRPCReactProvider>
    </AuthProvider>
  );
}
