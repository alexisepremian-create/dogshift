import TransitOverlay from "@/components/TransitOverlay";

const TRANSIT_SCRIPT = `(function(){try{var t=sessionStorage.getItem("ds_login_transit");if(t&&Date.now()-Number(t)<30000){var o=document.getElementById("__ds_transit");if(o)o.style.display="flex"}}catch(e){}})()`;

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* White overlay shown synchronously (before React) to prevent content flash during login transit */}
      <div
        id="__ds_transit"
        style={{
          display: "none",
          position: "fixed",
          inset: "0",
          zIndex: 9999,
          background: "white",
          alignItems: "center",
          justifyContent: "center",
        }}
      />
      <script dangerouslySetInnerHTML={{ __html: TRANSIT_SCRIPT }} />
      <TransitOverlay>{children}</TransitOverlay>
    </>
  );
}
