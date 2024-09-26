"use client";
import { Title } from "~/components/title";
import { Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle } from "~/components/ui/card";


interface DataCardProps {
    icon: React.ReactNode;
    title: string;
    children: React.ReactNode;
  }
  
  interface DataCardSectionProps {
    title: string;
    children: React.ReactNode;
    className?: string;
  }

  export default function DataCard(props: DataCardProps) {
    return (
      <Card className="shadow-none min-w-[750px] my-6">
        <CardHeader className="">
          <CardTitle className="uppercase flex place-items-end gap-3">{props.icon}{props.title}</CardTitle>
          </CardHeader>
        <CardContent className="flex flex-auto ">
          <CardDescription className="flex flex-col flex-auto justify-center">{props.children}</CardDescription>       
        </CardContent>
      </Card>
    );
  }

  export function DataCardSection(props: DataCardSectionProps) {
    return (
      <div className={`flex flex-col  justify-center border-b ${props.className}`}>
        <Title className="uppercase text-xs whitespace-nowrap font-normal">{props.title}</Title>
        <div className=" px-2 flex flex-col text-black">{props.children}</div>
      </div>
  )}
      

