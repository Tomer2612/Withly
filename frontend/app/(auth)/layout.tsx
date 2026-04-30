import SiteHeaderServer from '../components/SiteHeaderServer';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeaderServer hideAuthButtons />
      {children}
    </>
  );
}
