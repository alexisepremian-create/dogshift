import { proxy } from "./proxy";

export default proxy;

export const config = {
  matcher: [
    "/((?!_next|.*\\.(?:css|js|json|png|jpg|jpeg|gif|svg|webp|ico|txt|xml|map)$).*)",
    "/api/(.*)",
  ],
};
