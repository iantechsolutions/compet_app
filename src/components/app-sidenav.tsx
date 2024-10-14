import {
  ActivityIcon,
  ActivitySquareIcon,
  ArrowLeftIcon,
  BanknoteIcon,
  BarChartBigIcon,
  BarcodeIcon,
  CogIcon,
  DatabaseBackupIcon,
  DollarSignIcon,
  FileUpIcon,
  FingerprintIcon,
  LayoutDashboardIcon,
  MessageCircleQuestionIcon,
  MessageSquareReplyIcon,
  Settings2Icon,
  ShoppingBagIcon,
  Table2Icon,
  UsersIcon,
  Table
} from "lucide-react";
import { BackSidenavItem } from "./back-sidenav-item";
import Sidenav, { SidenavItem, SidenavSeparator } from "./sidenav";

export default function AppSidenav() {
  return (
    <Sidenav>
      <SidenavSeparator>Global</SidenavSeparator>
      <SidenavItem icon={<LayoutDashboardIcon />} href="/mrp">
        Inicio MRP
      </SidenavItem>
      <BackSidenavItem />
      <SidenavSeparator>MRP</SidenavSeparator>
      <SidenavItem icon={<Table2Icon />} href="/mrp/tabla">
        Tabla
      </SidenavItem>
      <SidenavItem icon={<Table />} href="/mrp/cuts">
        Tabla recortes
      </SidenavItem>
      {/* <SidenavItem icon={<BarcodeIcon />} href="/mrp/productos">Productos</SidenavItem>
        <SidenavItem icon={<ShoppingBagIcon />} href="/mrp/pedidos">Pedidos</SidenavItem> */}
      <SidenavItem icon={<BarChartBigIcon />} href="/mrp/forecast">
        Forecast
      </SidenavItem>
      <SidenavItem icon={<DatabaseBackupIcon />} href="/mrp/datos">
        Config. datos
      </SidenavItem>
      <SidenavItem icon={<CogIcon />} href="/mrp/consulta">
        Consulta prod.
      </SidenavItem>
      
    </Sidenav>
  );
}
