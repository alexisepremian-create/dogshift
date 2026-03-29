import { SplashProvider } from "@/components/SplashContext";
import BrandSplash from "@/components/BrandSplash";

const SPLASH_MODE_SCRIPT = `(function(){try{var d=document.documentElement.dataset,t=sessionStorage.getItem("ds_login_transit");d.splashMode=t&&Date.now()-Number(t)<3e4?"login":"normal"}catch(e){d.splashMode="normal"}})()`;

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <SplashProvider>
      <script dangerouslySetInnerHTML={{ __html: SPLASH_MODE_SCRIPT }} />
      <BrandSplash />
      {children}
    </SplashProvider>
  );
}
