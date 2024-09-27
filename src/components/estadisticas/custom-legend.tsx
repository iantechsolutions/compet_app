
type LegendProps = {
    textContent: string;
}

export default function LegendContent({textContent}: LegendProps) {
    return <div className="absolute left-2 right-0 mx-auto w-max flex items-center text-[#3e3e3e] font-semibold text-sm">
      <div className="w-3 h-3 inline-block bg-[#8884d8] mr-2"></div>
      {textContent}
      </div>
  }
  