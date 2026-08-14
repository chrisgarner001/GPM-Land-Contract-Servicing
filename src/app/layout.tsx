import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import { isSuperUser } from "@/lib/superUser";
import { getTheme } from "@/lib/theme";
import Sidebar from "@/app/_components/Sidebar";
import UserMenu from "@/app/_components/UserMenu";
import HelpWidget from "@/app/_components/HelpWidget";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GPM Land Contract Servicing",
  description: "Internal land contract servicing system",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Borrower/Lender portal previews (staff "Log In As") run under a real
  // staff Supabase session, but must look exactly like what that borrower/
  // lender would see — no staff nav leaking into the preview.
  const pathname = (await headers()).get("x-pathname") ?? "";
  const isPortalRoute = pathname.startsWith("/online-portals/");
  const showStaffChrome = Boolean(user) && !isPortalRoute;
  const superUser = showStaffChrome && (await isSuperUser(user?.email));
  const theme = await getTheme();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased ${theme === "dark" ? "dark" : ""}`}
    >
      <body className="min-h-full flex flex-col bg-white dark:bg-neutral-950">
        {showStaffChrome && (
          <div className="flex items-center justify-end border-b border-slate-200 bg-white px-6 py-2 dark:border-neutral-800 dark:bg-neutral-900 print:hidden">
            <UserMenu userEmail={user!.email ?? ""} theme={theme} />
          </div>
        )}
        <div className="flex flex-1">
          {showStaffChrome && <Sidebar isSuperUser={superUser} />}
          <div className="min-w-0 flex-1">{children}</div>
        </div>
        {showStaffChrome && <div className="print:hidden"><HelpWidget /></div>}
      </body>
    </html>
  );
}
