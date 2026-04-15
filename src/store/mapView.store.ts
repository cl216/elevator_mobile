import { create } from "zustand";

type SavedMapView = {
  center: [number, number] | null;
  zoom: number | null;
  hasHydratedView: boolean;
  setMapView: (payload: { center: [number, number]; zoom: number }) => void;
  clearMapView: () => void;
};

export const useMapViewStore = create<SavedMapView>((set) => ({
  center: null,
  zoom: null,
  hasHydratedView: false,

  setMapView: ({ center, zoom }) =>
    set({
      center,
      zoom,
      hasHydratedView: true,
    }),

  clearMapView: () =>
    set({
      center: null,
      zoom: null,
      hasHydratedView: false,
    }),
}));