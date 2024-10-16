"use client";
import { Loader2Icon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import AppSidenav from "~/components/app-sidenav";
import AppLayout from "~/components/applayout";
import DataUploadingCard from "~/components/data-uploading-card";
import type { NavUserData } from "~/components/nav-user-section";
import { Title } from "~/components/title";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import type { RouterOutputs } from "~/trpc/shared";
import ForecastDialogForm from "./forecast-dialog-form";
import ForecastProfileCard from "./forecast-profile-card";
import type { ForecastProfile } from "~/mrp_data/transform_mrp_data";

export default function ForecastSettingsPage(props: { user?: NavUserData; forecastProfiles: RouterOutputs["forecast"]["listProfiles"] }) {
  const { mutateAsync: deleteProfile } = api.forecast.deleteProfile.useMutation();
  const { mutateAsync: applyProfile, isLoading: isApplyingProfile } = api.forecast.applyProfile.useMutation();
  const { mutateAsync: applyNullProfile, isLoading: isApplyingNullProfile } = api.forecast.applyNullProfile.useMutation();
  const { data: monolito, isLoading: isLoadingData } = api.db.getMonolito.useQuery({
    data: {
      budgetsById: true,
      crm_clients: true,
      clientsByCode: true,
      budget_products: true
    }
  });

  const isApplying = isApplyingProfile || isApplyingNullProfile;
  const router = useRouter();

  async function handleDeleteProfile(id: number) {
    if (confirm("¿Estás seguro de que quieres eliminar este perfil?")) {
      void deleteProfile({ id }).finally(() => {
        router.refresh();
      });
    }
  }

  function handleApplyProfile(id: number) {
    void applyProfile({ id })
      .then(() => {
        console.log("Applied profile!", id);
      })
      .finally(() => {
        router.refresh();
      });
  }

  function handleApplyNullProfile() {
    void applyNullProfile()
      .then(() => {
        console.log("Applied null profile!");
      })
      .finally(() => {
        router.refresh();
      });
  }

  if (isLoadingData || !monolito) {
    return <div className="fixed bottom-0 left-0 right-0 top-0 flex items-center justify-center">
      <Button variant="secondary" disabled>
        <Loader2Icon className="mr-2 animate-spin" /> Cargando datos
      </Button>
    </div>;
  }

  let appliedProfile: ForecastProfile | undefined = monolito.data.forecastData?.forecastProfile;
  if (!appliedProfile?.id)
    appliedProfile = undefined;

  const isUpdating = false;

  return (
    <AppLayout title={<h1>Configuración de forecast</h1>} user={props?.user} sidenav={<AppSidenav />}>
      {appliedProfile && !isUpdating && (
        <div className="mb-3">
          <p className="font-bold">Perfil actual: {appliedProfile.name}</p>
          <p className="text-xs">
            Porcentaje de incremento de predicción de ventas: {(appliedProfile.salesIncrementFactor * 100).toFixed(1)}%
          </p>
          <p className="text-xs">
            Porcentaje de incremento de predicción de ventas: {(appliedProfile.budgetsInclusionFactor * 100).toFixed(1)}%
          </p>
        </div>
      )}

      <DataUploadingCard />

      <div className="mt-6" />

      <div className="flex justify-between">
        <Title>Perfiles de forecast</Title>
        <ForecastDialogForm disabled={isUpdating} monolito={monolito}>
          <Button disabled={isApplying} type="button" className="ml-auto">
            <PlusIcon className="mr-2" />
            Crear perfil
          </Button>
        </ForecastDialogForm>
      </div>

      <div className="mt-2">
        <ul className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <li className="relative min-h-[120px] items-center rounded-xl border border-dashed p-5">
            <h2 className="w-full font-semibold">Sin forecast</h2>
            <div className="absolute bottom-5 left-5">
              {!isApplyingNullProfile && !isUpdating && (
                <Button onClick={handleApplyNullProfile} disabled={!appliedProfile}>
                  {appliedProfile ? "Aplicar" : "Aplicado"}
                </Button>
              )}
              {isApplyingNullProfile && (
                <Button disabled>
                  <Loader2Icon className="mr-2 animate-spin" />
                  Aplicando
                </Button>
              )}
            </div>
          </li>
          {props.forecastProfiles.map((profile) => {
            return (
              <ForecastProfileCard
                key={profile.id}
                monolito={monolito}
                profile={profile}
                handleApplyProfile={handleApplyProfile}
                handleDeleteProfile={handleDeleteProfile}
                isLoading={isApplying ?? isUpdating}
              />
            );
          })}
        </ul>
      </div>
    </AppLayout>
  );
}
