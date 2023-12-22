import Sidenav, { SidenavItem, SidenavSeparator } from "./sidenav"
import { ActivityIcon, ActivitySquareIcon, BanknoteIcon, BarChartBigIcon, BarcodeIcon, DollarSignIcon, FileUpIcon, FingerprintIcon, LayoutDashboardIcon, MessageCircleQuestionIcon, MessageSquareReplyIcon, Settings2Icon, ShoppingBagIcon, Table2Icon, UsersIcon } from 'lucide-react';

export default function AppSidenav() {
    return <Sidenav>
        <SidenavSeparator>Global</SidenavSeparator>
        <SidenavItem icon={<LayoutDashboardIcon />} href="/mrp">Dashboard</SidenavItem>
        <SidenavSeparator>MRP</SidenavSeparator>
        <SidenavItem icon={<Table2Icon />} href="/mrp/tabla">Tabla</SidenavItem>
        <SidenavItem icon={<BarcodeIcon />} href="/mrp/productos">Productos</SidenavItem>
        <SidenavItem icon={<ShoppingBagIcon />} href="/mrp/pedidos">Pedidos</SidenavItem>
        <SidenavItem icon={<BarChartBigIcon />} href="/mrp/forecast">Forecast</SidenavItem>
    </Sidenav>
}