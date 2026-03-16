"use client";

import { createContext, useContext } from "react";

type ConversationExpandContextValue = {
  isExpanded: boolean;
  setIsExpanded: (value: boolean | ((current: boolean) => boolean)) => void;
};

const ConversationExpandContext = createContext<ConversationExpandContextValue | null>(null);

export function ConversationExpandProvider({
  value,
  children,
}: {
  value: ConversationExpandContextValue;
  children: React.ReactNode;
}) {
  return <ConversationExpandContext.Provider value={value}>{children}</ConversationExpandContext.Provider>;
}

export function useConversationExpand() {
  const context = useContext(ConversationExpandContext);
  if (!context) {
    throw new Error("useConversationExpand must be used within ConversationExpandProvider");
  }
  return context;
}
