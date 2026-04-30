import SiteHeaderServer from '../components/SiteHeaderServer';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeaderServer />
      {children}
    </>
  );
}
