"use client";

import Link from "next/link";
import type { LinkProps } from "next/link";

type ViewTransitionLinkProps = LinkProps & {
  className?: string;
  children: React.ReactNode;
};

export default function ViewTransitionLink({ href, ...props }: ViewTransitionLinkProps) {
  return <Link href={href} {...props} />;
}
