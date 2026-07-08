import createMiddleware from "next-intl/middleware";
import { routing } from "./src/i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: [
    // Match all pathnames except internal Next.js paths and static files
    "/((?!_next|api|l/|favicon\\.ico|favicon\\.jpg|og-image\\.jpg|og-logo\\.jpg|hero-campus\\.jpg|placeholder\\.svg|debug|sitemap\\.xml|robots\\.txt|manifest\\.webmanifest).*)",
  ],
};
