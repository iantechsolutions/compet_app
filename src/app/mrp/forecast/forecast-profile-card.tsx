import dayjs from "dayjs";
import { Trash2Icon } from "lucide-react";
import { useMemo } from "react";
import ListSelectionDialog from "~/components/list-selection-dialog";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import type { CrmBudget } from "~/lib/types";
import { formatStock } from "~/lib/utils";
import type { Monolito } from "~/server/api/routers/db";

export default function ForecastProfileCard(props: {
  profile: Monolito['forecastProfiles'][number];
  handleDeleteProfile: (id: number) => void;
  handleApplyProfile: (id: number) => void;
  isLoading: boolean;
  budget_products: NonNullable<Monolito['budget_products']>;
  budgetsById: NonNullable<Monolito['budgetsById']>;
  crm_clients: NonNullable<Monolito['crm_clients']>;
  clientsByCode: NonNullable<Monolito['clientsByCode']>;
}) {
  const profile = props.profile;

  const quantityByClient = new Map<string, number>();
  const budgetsByClient = new Map<string, CrmBudget[]>();

  for (const budgetProduct of props.budget_products) {
    const budget = props.budgetsById[budgetProduct.budget_id];
    if (!budget) continue;

    let qty = quantityByClient.get(budget.client_id) ?? 0;
    qty += budgetProduct.quantity;
    quantityByClient.set(budget.client_id, qty);

    const budgets = budgetsByClient.get(budget.client_id) ?? [];
    budgets.push(budget);
    budgetsByClient.set(budget.client_id, budgets);
  }

  const clientsWithBudgets = useMemo(() => {
    return props.crm_clients.filter(
      (client) => quantityByClient.has(client.client_id) || (client.tango_code.trim() && props.clientsByCode[client.tango_code]),
    );
  }, [props.crm_clients, quantityByClient]);

  return (
    <li>
      <Card>
        <CardHeader>
          <CardTitle>{profile.name}</CardTitle>
        </CardHeader>
        <CardContent>
          {profile.includeSales && (
            <p className="text-sm font-medium">Incremento ventas: {(profile.salesIncrementFactor * 100).toFixed(1)}%</p>
          )}
          {profile.includeBudgets && (
            <p className="text-sm font-medium">Inclusión de presupuestos: {(profile.budgetsInclusionFactor * 100).toFixed(1)}%</p>
          )}
          {!profile.clientInclusionList && <p className="text-sm font-medium">Clientes: (todos)</p>}
          {profile.clientInclusionList && clientsWithBudgets && (
            <p className="text-sm font-medium">
              Clientes:
              <ListSelectionDialog
                readOnly
                options={clientsWithBudgets.map((client) => ({
                  value: client.client_id.toString(),
                  title: client.name || client.business_name,
                  subtitle: `Presupuestos: ${budgetsByClient.get(client.client_id)?.length
                    }. Total presupuestado: ${formatStock(quantityByClient.get(client.client_id) ?? 0)}.`,
                }))}
                title="Clientes incluidos"
                onApply={() => void 0}
                defaultValues={clientsWithBudgets.map((c) => c.client_id.toString())}
              >
                <a href="javascript:void(0)" className="ml-1 text-blue-500 underline">
                  ({profile.clientInclusionList.length} seleccionados)
                </a>
              </ListSelectionDialog>
            </p>
          )}
          <p className="mt-1 text-xs">{dayjs(profile.createdAt).format("DD/MM/YYYY - HH:mm")}</p>
        </CardContent>
        <CardFooter>
          {!profile.current && (
            <Button disabled={props.isLoading} onClick={() => props.handleApplyProfile(profile.id)}>
              Aplicar
            </Button>
          )}
          {profile.current && <Button disabled>Aplicado</Button>}
          {!profile.current && (
            <button className="mr-2 p-2 hover:bg-stone-100 active:bg-stone-200" onClick={() => props.handleDeleteProfile(profile.id)}>
              <Trash2Icon size={16} className="text-red-500" />
            </button>
          )}
        </CardFooter>
      </Card>
    </li>
  );
}

// return <li key={profile.id} className="flex items-center border-l-4 border-l-stone-500 pl-2 mb-4">
//     <div className="w-full">
//         <h2 className="font-semibold">{profile.name}</h2>
//         {profile.includeSales && <p className="text-sm font-medium">
//             Incremento ventas: {(profile.salesIncrementFactor * 100).toFixed(1)}%
//         </p>}
//         {profile.includeBudgets && <p className="text-sm font-medium">
//             Inclusión de presupuestos: {(profile.budgetsInclusionFactor * 100).toFixed(1)}%
//         </p>}
//         <p className="text-xs">{dayjs(profile.createdAt).format('DD/MM/YYYY - HH:mm')}</p>
//     </div>
//     {!profile.current && <button className="p-2 hover:bg-stone-100 active:bg-stone-200 mr-2"
//         onClick={() => handleDeleteProfile(profile.id)}
//     >
//         <Trash2Icon size={16} className="text-red-500" />
//     </button>}
//     {!profile.current && <Button
//         disabled={isApplying || isUpdating}
//         onClick={() => handleApplyProfile(profile.id)}
//     >Aplicar</Button>}
//     {profile.current && <Button
//         disabled
//     >Aplicado</Button>}
// </li>
