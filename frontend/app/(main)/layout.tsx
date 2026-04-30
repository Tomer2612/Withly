import SiteHeader from '../components/SiteHeader';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}
