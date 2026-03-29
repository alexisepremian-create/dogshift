import { SplashProvider } from "@/components/SplashContext";
import BrandSplash from "@/components/BrandSplash";

const SPLASH_MODE_SCRIPT = `(function(){try{var s=sessionStorage,d=document.documentElement.dataset,done=s.getItem("ds_splash_done");if(done){s.removeItem("ds_splash_done");d.splashMode="static"}else{var t=s.getItem("ds_login_transit");d.splashMode=t&&Date.now()-Number(t)<3e4?"login":"normal"}}catch(e){d.splashMode="normal"}})()`;

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <SplashProvider>
      <script dangerouslySetInnerHTML={{ __html: SPLASH_MODE_SCRIPT }} />
      <BrandSplash />
      {children}
    </SplashProvider>
  );
}
