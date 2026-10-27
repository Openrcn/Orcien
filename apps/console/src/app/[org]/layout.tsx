import OrgNotFoundGuard from "./not-found-guard";

export default function OrgLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <OrgNotFoundGuard />
      {children}
    </>
  );
}
