"use client";

import ContractAmendmentBlockingModal from "@/components/ContractAmendmentBlockingModal";
import { useHostUser } from "@/components/HostUserProvider";

export default function HostContractAmendmentModal() {
  const host = useHostUser();
  return <ContractAmendmentBlockingModal sitterId={host.sitterId} state={host.contractAmendment} />;
}
