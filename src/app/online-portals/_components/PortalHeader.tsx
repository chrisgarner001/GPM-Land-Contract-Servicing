import Image from "next/image";

export default function PortalHeader() {
  return (
    <div className="mb-6 border-b border-slate-200 pb-4">
      <Image
        src="/sgms-logo-full.png"
        alt="Success Group Mortgage & Servicing LLC"
        width={761}
        height={201}
        className="h-10 w-auto"
        priority
      />
    </div>
  );
}
