import OwnerListRouteSkeleton from "@/components/native/OwnerListRouteSkeleton";

export default function Loading() {
  // Native: the SAME fixed overlay the route-group boundary renders, so the two
  // suspend phases show one unmoving skeleton (not two different ones). Web: a
  // plain AccountPageSkeleton (handled inside OwnerListRouteSkeleton).
  return <OwnerListRouteSkeleton />;
}
