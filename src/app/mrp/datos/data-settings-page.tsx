"use client";
import { getUserSetting, setUserSetting } from "~/lib/settings";
import dayjs from "dayjs";
import { Loader2Icon} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import AppSidenav from "~/components/app-sidenav";
import AppLayout from "~/components/applayout";
import DataUploadingCard from "~/components/data-uploading-card";
import { useMRPData, useMRPInvalidateAndReloadData } from "~/components/mrp-data-provider";
import type { NavUserData } from "~/components/nav-user-section";
import { Title } from "~/components/title";
import { Button } from "~/components/ui/button";
import { Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle } from "~/components/ui/card";
import { useGlobalState, useOnMounted } from "~/lib/hooks";
import { nullProfile } from "~/lib/nullForecastProfile";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import type { RouterOutputs } from "~/trpc/shared";
import { Input } from "~/components/ui/input";
import { CustomHover } from "~/components/custom-hover";
import DataCard, { DataCardSection } from "../../../components/ui/dataCard";
import { ChartNoAxesCombined } from "~/components/icons/chart-combined";
import Database02Icon from "~/components/icons/database-02-stroke-rounded";
import MailAtSign01Icon from "~/components/icons/mail-at-sign-01-stroke-rounded";
import CancelCircleIcon from "~/components/icons/cancel-circle-stroke-rounded";
import AddCircleIcon from "~/components/icons/add-circle-stroke-rounded";

export default function DataSettingsPage(props: {
  user?: NavUserData & { id: string };
  dataInfo: RouterOutputs["mrpData"]["mrpDataInfo"];
  forecastProfile: RouterOutputs["forecast"]["currentProfile"];
  mails: string[] | null;
}) {
  const date = dayjs(props.dataInfo.exportDate);
  const data = useMRPData();
  const invalidateAndReloadData = useMRPInvalidateAndReloadData();
  const forecastProfile = props.forecastProfile ?? nullProfile;

  const dataMismatch = data.forecastData?.forecastProfile.id != forecastProfile.id || data.dataExportUrl != props.dataInfo.exportURL;

  return (
    <AppLayout title={<h1>Config. de datos</h1>} user={props.user} sidenav={<AppSidenav />}>
      <DataUploadingCard />
      <DataCard icon={<ChartNoAxesCombined />} title={"Origen de datos"}>
        <section className="flex flex-row flex-auto gap-8 justify-between mx-8">
          <DataCardSection title={"Última exportación de datos"} className="w-60">
            <p><b>{date.format("DD/MM/YYYY")}</b>{` `}a las{` `}<b>{date.format("HH:mm:ss")}</b></p>
          </DataCardSection>
          <DataCardSection title={"Archivo de datos"} className="w-40">
            <Link href={props.dataInfo.exportURL} className="font-semibold text-[#5da4f5] underline-none" target="_blank">
              Link aquí
            </Link>
          </DataCardSection>
          <DataCardSection title={"Perfil de forecast"} className="w-52">
            <p><b>{forecastProfile.name} (id: {forecastProfile.id ?? 0})</b></p>
          </DataCardSection>
        </section>

        <Title className="text-base font-semibold tracking-tight uppercase mt-5 text-black">Mostrando actualmente</Title>
        <section className="flex flex-row flex-auto  gap-8 justify-between mx-8">
          <DataCardSection title={"Archivo de datos"} className="w-60">
            <Link href={data.dataExportUrl} className="font-semibold text-[#5da4f5] underline-none" target="_blank">
              Link aquí
            </Link>
          </DataCardSection>
          <DataCardSection title={"Perfil de forecast"} className="w-40">
            <p><b>{data.forecastData!.forecastProfile.name} (id: {data.forecastData!.forecastProfile.id ?? 0})</b></p>
          </DataCardSection>
          <DataCardSection title={"Última exportación de datos"} className="w-52">
            <p><b>{dayjs(data.dataExportDate).format("DD/MM/YYYY")}</b>
            {` `}a las{` `}
            <b>{dayjs(data.dataExportDate).format("HH:mm:ss")}</b></p>
          </DataCardSection>
        </section>
        {dataMismatch && (
          <div className="flex mt-8 justify-center">
          <p className="font-semibold text-red-500 opacity-60">Los datos mostrados no coinciden con los datos exportados. Recargue los datos.</p>
        </div>)}
      {!dataMismatch && (
        <div className="flex mt-8 justify-center">
          <p className="font-semibold text-green-500 opacity-60">Datos sincronizados correctamente.</p>
        </div>)}
        <Button
        className=" mx-auto px-8 font-semibold mt-6"
        onClick={() => invalidateAndReloadData()}
        variant={dataMismatch ? "default" : "secondary"}>
        Recargar datos
      </Button>
      </DataCard>
            
      <DataCard icon={<Database02Icon/>} title={"Base de datos de tango"}>
        <RemoteUpdateComponent />
      </DataCard>

      <DataCard icon={<Database02Icon/>} title={"Configuración de stock crítico"}>
        <MailSendingConfiguration id={props.user?.id ?? ""} />
      </DataCard>
    </AppLayout>
  );
}

export type RemoteUpdateProgress = {
  value: number;
  message: string;
  finished: boolean;
  timestamp: number;
  error: boolean;
};

function RemoteUpdateComponent() {
  const [requestRemoteUpdate, setRequestRemoteUpdate] = useGlobalState<(() => void) | null>("mrp.data.requestRemoteUpdate", null);
  const [remoteUpdateProgress, _setRemoteUpdateProgress] = useGlobalState<RemoteUpdateProgress | null>(
    "mrp.data.remoteUpdateProgress",
    null,
  );
  const progressRef = useRef<RemoteUpdateProgress | null>(remoteUpdateProgress);

  const setRemoteUpdateProgress = (value: RemoteUpdateProgress | null) => {
    progressRef.current = value;
    _setRemoteUpdateProgress(value);
  };

  const invalidateAndReloadData = useMRPInvalidateAndReloadData();

  const timerRef = useRef<any>(0);

  useOnMounted(() => {
    listenScaledrone();
  });

  const router = useRouter();

  async function listenScaledrone() {
    const rc = await fetch("/api/scaledrone_channel");
    const { channel } = await rc.json();

    const drone = new Scaledrone(channel);

    drone.on("open", async (error) => {
      if (error) {
        console.error(error);
        return;
      }

      const rt = await fetch("/api/scaledrone_jwt?client_id=" + drone.clientId);
      const { token } = await rt.json();

      drone.authenticate(token);
    });

    drone.on("authenticate", (error) => {
      if (error) {
        console.error(error);
      } else {
        console.log("authenticated");

        onReady();
      }
    });

    drone.on("error", (error) => {
      console.error(error);
    });

    function onReady() {
      console.log("messaging ready");

      const room = drone.subscribe("update_progress");

      drone.publish({
        room: "request_data_update",
        message: "null",
      });

      setRequestRemoteUpdate(() => {
        return () => {
          console.log("requesting remote update");

          clearTimeout(timerRef.current!);

          timerRef.current = setTimeout(() => {
            if (progressRef.current?.value != 0) return;

            setRemoteUpdateProgress({
              value: 0,
              message: "Error de conexión (el servidor no responde)",
              finished: false,
              timestamp: Date.now(),
              error: true,
            });
          }, 25000);

          setRemoteUpdateProgress({
            value: 0,
            message: "Esperando información del servidor",
            finished: false,
            timestamp: Date.now(),
            error: false,
          });

          drone.publish({
            room: "request_data_update",
            message: Date.now().toString(),
          });
        };
      });

      room.on("message", async (message) => {
        const data = JSON.parse(message.data) as RemoteUpdateProgress;
        if (data.finished) {
          invalidateAndReloadData();
          router.refresh();
          setTimeout(() => {
            setRemoteUpdateProgress(null);
          }, 200);
        } else {
          setRemoteUpdateProgress(data);
        }
      });
    }
  }

  return (
    <section className="flex justify-center mx-auto">
      {(!remoteUpdateProgress || remoteUpdateProgress.error) && (
        <Button
          className="px-8"
          onClick={() => {
            requestRemoteUpdate?.();
          }}
          disabled={!requestRemoteUpdate}
        >
          Solicitar actualización de datos
        </Button>
      )}

      {remoteUpdateProgress && (
        <Card className="flex items-center gap-5 break-words p-5 mx-auto">
          {!remoteUpdateProgress.error && <Loader2Icon className="mr-2 animate-spin" />}
          <p
            className={cn("font-medium", {
              "text-red-500": remoteUpdateProgress?.error,
            })}
          >
            {progressRef.current?.message}
          </p>
        </Card>
      )}
    </section>
  );
}

function MailSendingConfiguration(user: NavUserData & { id: string }) {
  const [hasQueried, setHasQueried] = useState(false);
  const [sendingMails, setSendingMails] = useState(false);
  const [hasQueriedConfig, setHasQueriedConfig] = useState(false);
  // const { data: mails } = api.mail.getMails.useQuery({ userId: user.id });
  const { data: mails } = api.mail.getMails.useQuery(
    { userId: user.id ?? "" },
    {
      enabled: !!user.id && !hasQueried,
      onSuccess: () => {
        setHasQueried(true);
      },
    },
  );

  const { data: mailsConfig } = api.mail.getMailsConfig.useQuery(
    { userId: user.id ?? "" },
    {
      enabled: !!user.id && !hasQueriedConfig,
      onSuccess: () => {
        setHasQueriedConfig(true);
      },
    },
  );

  useEffect(() => {
    if (mails && mails.length === 0) {
      setMails([""]);
    } else {
      setMails(mails ?? [""]);
    }
  }, [mails]);
  useEffect(() => {
    if (mailsConfig) {
      setFirstCheck(mailsConfig.firstCheck ?? 2);
      setSecondCheck(mailsConfig.secondCheck ?? 12);
      setBelowNMonths(mailsConfig.BelowNMonths ?? 0);
    }
    // else{
    //     setMails(mails ?? [""]);
    // }
  }, [mailsConfig]);
  const { mutateAsync: setMailsList, isLoading } = api.mail.setMails.useMutation();

  const { mutateAsync: setMailConfig, isLoading: isMailConfigLoading } = api.mail.setMailConfig.useMutation();

  if (mails && mails.length === 0) {
    setMailsList({ mails: [], userId: user.id });
  }
  const [mailsList, setMails] = useState<string[]>(mails ?? [""]);
  const [firstCheck, setFirstCheck] = useState<number>(mailsConfig?.firstCheck ?? 2);
  const [secondCheck, setSecondCheck] = useState<number>(mailsConfig?.secondCheck ?? 12);
  const [belowNMonths, setBelowNMonths] = useState<number>(mailsConfig?.BelowNMonths ?? 0);
  function handleEmailChange(mail: string, index: number) {
    const newMails = [...mailsList];
    newMails[index] = mail;
    setMails(newMails);
  }
  function handleMailListSave(newMails: string[]) {
    setMailsList({ mails: newMails, userId: user.id });
    setMailConfig({
      firstCheck,
      secondCheck,
      BelowNMonths: belowNMonths,
      userId: user.id,
    });
  }

  async function handleMailTest(newMails: string[]) {
    setSendingMails(true);
    await fetch("/api/individualMail");
    setSendingMails(false);
  }

  function insertMailAtIndex(index: number) {
    setMails((prevMails) => {
      const updatedMails = [...prevMails];
      const currentEntry = updatedMails[index];
      updatedMails.splice(index, 0, currentEntry ?? "");
      return updatedMails;
    });
  }

  return (
    <section className="relative w-full pb-14 mb-0">
      <div className="flex flex-col flex-auto max-w-[600px]">

      <>
        <div className="mb-3">
          <div className="flex justify-start">
            <p className="py-2">Cantidad de meses primera revision</p>
            {/* <CustomHover hoverText="?" hoverContent='' /> */}
            <CustomHover
               hoverContent={"Cantidad de meses a futuro en los que buscar stock critico (incluyendo mes actual)"}
               />
          </div>
          <Input
            disabled={isLoading || isMailConfigLoading}
            id="name"
            name="name"
            type="number"
            value={firstCheck}
            onChange={(e) => setFirstCheck(Number(e.target.value))}
            placeholder="2"
            required
            />
        </div>
        <div className="mb-3">
          <div className="flex justify-start">
            <p className="py-2">Cantidad de meses segunda revision</p>
            <CustomHover
               hoverContent={"Cantidad de meses a futuro en los que buscar la regularizacion del stock critico (incluyendo mes actual)"}
            />
          </div>
          <Input
            disabled={isLoading || isMailConfigLoading}
            id="name"
            name="name"
            value={secondCheck}
            type="number"
            onChange={(e) => setSecondCheck(Number(e.target.value))}
            placeholder="12"
            required
            />
        </div>
        <div className="mb-3">
          <div className="flex justify-start">
            <p className="py-2">Cantidad de meses para regularización del stock</p>
            <CustomHover
              hoverContent={<p>No se notificara el insumo, en caso de que el stock se regularize antes de pasadas esta cantidad de meses.
                <br/>
                Ej: Si un insumo se queda en menos de 0 en Enero, no se notificaria si este numero es mayor a 1.</p>}
            />
          </div>
          <Input
            disabled={isLoading || isMailConfigLoading}
            id="name"
            name="name"
            value={belowNMonths}
            type="number"
            onChange={(e) => setBelowNMonths(Number(e.target.value))}
            placeholder="0"
            required
            />
        </div>
      </>
      <Title className="flex text-base font-semibold tracking-tight uppercase mt-12 text-black gap-3">
      <MailAtSign01Icon/>
        Mails a los que notificar en caso de stock critico</Title>
      {/* <Button 
            className='mb-5'
            onClick={() => {
              setMails([...mailsList, '']);
              }
              
              }>
              Agregar mail
              </Button> */}
      <br />
      {mailsList &&
        mailsList.map((mail, index) => (
          <div key={index} className="mb-4 flex items-center gap-3 p-4">
            <div>
              <Input
                id="name"
                name="name"
                value={mailsList[index]}
                onChange={(e) => handleEmailChange(e.target.value, index)}
                placeholder="xxx@xxx.com"
                required
                />
            </div>
            <Button
              disabled={isLoading || isMailConfigLoading || sendingMails}
              onClick={() => {
                insertMailAtIndex(index);
              }}
              variant="question"
              >
              <AddCircleIcon className="h-6 w-6" />
            </Button>
            {!(mailsList.length === 1 || isLoading || isMailConfigLoading || sendingMails) && (
              <Button
              onClick={() => {
                const newMails = [...mailsList];
                newMails.splice(index, 1);
                setMails(newMails);
              }}
              variant="question"
              >
                <CancelCircleIcon className="h-6 w-6" />
              </Button>
            )}
          </div>
        ))}
      <div className="mb-2 absolute bottom-0 w-full flex justify-center gap-3 p-4 ">
        <Button
        className="flex px-6"
        onClick={() => {
          handleMailListSave(mailsList);
        }}
          disabled={isLoading || isMailConfigLoading || sendingMails}
        >
          {isLoading && <Loader2Icon className="mr-2 animate-spin" />}
          Guardar configuracion
        </Button>
        {/* <Button
          onClick={() => {
            handleMailTest(mailsList);
            }}
            disabled={isLoading || isMailConfigLoading || sendingMails}
            >
            {sendingMails && <Loader2Icon className="mr-2 animate-spin" />}
            Enviar mails
            </Button> */}
      </div>
      </div>
    </section>
  );
}
