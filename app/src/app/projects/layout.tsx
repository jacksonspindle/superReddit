import { Toaster } from '@/components/ui/sonner';

export const dynamic = 'force-dynamic';

export default function ProjectsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}
