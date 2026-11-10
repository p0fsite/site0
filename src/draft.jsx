import { createContext, useContext, useMemo, useState } from "react";
import { pageFromDraft, sampleDraft } from "./content.js";

const DraftContext = createContext(null);

export function DraftProvider({ children }) {
  const [draft, setDraft] = useState(sampleDraft);
  const [page, setPage] = useState(() => pageFromDraft(sampleDraft));
  const [notice, setNotice] = useState("");

  const value = useMemo(
    () => ({ draft, setDraft, page, setPage, notice, setNotice }),
    [draft, page, notice],
  );

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useDraft() {
  const value = useContext(DraftContext);
  if (!value) throw new Error("useDraft must be used inside DraftProvider");
  return value;
}
