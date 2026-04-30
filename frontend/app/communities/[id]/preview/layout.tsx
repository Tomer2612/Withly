import SiteHeaderServer from '../../../components/SiteHeaderServer';

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeaderServer />
      {children}
    </>
  );
}
