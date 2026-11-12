import React, { createContext, useContext } from "react";

const ClassroomPresentationContext = createContext({
  setBoard: () => {},
  setSpeaking: () => {},
});

export function ClassroomPresentationProvider({ value, children }) {
  return (
    <ClassroomPresentationContext.Provider value={value}>
      {children}
    </ClassroomPresentationContext.Provider>
  );
}

export function useClassroomPresentation() {
  return useContext(ClassroomPresentationContext);
}
