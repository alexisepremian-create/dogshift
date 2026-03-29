import { SplashProvider } from "@/components/SplashContext";
import BrandSplash from "@/components/BrandSplash";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <SplashProvider>
      <BrandSplash />
      {children}
    </SplashProvider>
  );
}
