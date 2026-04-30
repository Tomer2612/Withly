import SiteHeader from '../../../components/SiteHeader';

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}
