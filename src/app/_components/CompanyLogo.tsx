import Image from "next/image";

export default function CompanyLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Image src="/gpm-mark.svg" alt="" width={40} height={43} className="h-full w-auto shrink-0" priority />
      <span className="text-2xl font-bold tracking-tight text-[#2929c6]">GPM</span>
    </div>
  );
}
