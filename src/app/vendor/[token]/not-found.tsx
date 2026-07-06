import { Link2Off } from "lucide-react";

export default function VendorPortalNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#07080b] px-4 text-white">
      <div className="max-w-sm text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-lg border border-rose-400/25 bg-rose-400/10 text-rose-100">
          <Link2Off size={22} />
        </div>
        <h1 className="mt-5 text-2xl font-semibold">Upload link expired</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Ask the property manager to send a fresh VendorProof upload link.
        </p>
      </div>
    </main>
  );
}
