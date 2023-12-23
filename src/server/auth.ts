import { auth } from "~/app/api/auth/[...nextauth]/route";
 
export const getServerAuthSession = () => auth();
