import { createContext, useContext } from "react";

export const EditorSelection = createContext<{ selectedId: string | null; setSelectedId: (id: string | null) => void }>({ selectedId: null, setSelectedId: () => {} });
export const useEditorSelection = () => useContext(EditorSelection);
