/** biome-ignore-all lint/style/useNamingConvention: Google Maps callback naming */
interface GoogleMapsApiNamespace {
  maps?: {
    importLibrary?: (libraryName: string) => Promise<unknown>;
  };
}

declare global {
  interface Window {
    google?: GoogleMapsApiNamespace;
    __cmuMapsGoogleMaps3DLoaderCallback__?: () => void;
  }
}

let googleMaps3dLoadPromise: Promise<GoogleMapsApiNamespace> | null = null;

const MAPS_SCRIPT_SELECTOR = 'script[data-cmu-maps-google-maps="maps3d"]';
const MAPS_CALLBACK = "__cmuMapsGoogleMaps3DLoaderCallback__";

const loadGoogleMaps3D = (apiKey: string): Promise<GoogleMapsApiNamespace> => {
  if (window.google?.maps?.importLibrary) {
    return Promise.resolve(window.google as GoogleMapsApiNamespace);
  }

  if (googleMaps3dLoadPromise !== null) {
    return googleMaps3dLoadPromise;
  }

  const loadPromise = new Promise<GoogleMapsApiNamespace>((resolve, reject) => {
    window[MAPS_CALLBACK] = () => {
      const googleMaps = window.google;
      if (!googleMaps?.maps?.importLibrary) {
        reject(new Error("Google Maps script loaded, but maps.importLibrary is unavailable."));
        return;
      }
      resolve(googleMaps);
    };

    const existingScript = document.querySelector(MAPS_SCRIPT_SELECTOR) as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener(
        "load",
        () => {
          const googleMaps = window.google;
          if (!googleMaps?.maps?.importLibrary) {
            reject(new Error("Google Maps script loaded, but maps.importLibrary is unavailable."));
            return;
          }
          resolve(googleMaps);
        },
        { once: true },
      );
      existingScript.addEventListener(
        "error",
        () => {
          reject(new Error("Failed to load Google Maps JavaScript API."));
        },
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.dataset["cmuMapsGoogleMaps"] = "maps3d";
    script.async = true;
    script.defer = true;

    const queryParams = new URLSearchParams({
      key: apiKey,
      v: "alpha",
      loading: "async",
      libraries: "maps3d",
      callback: MAPS_CALLBACK,
    });
    script.src = `https://maps.googleapis.com/maps/api/js?${queryParams.toString()}`;
    script.onerror = () => {
      reject(new Error("Failed to load Google Maps JavaScript API."));
    };
    document.head.append(script);
  }).catch((error) => {
    googleMaps3dLoadPromise = null;
    throw error;
  });

  googleMaps3dLoadPromise = loadPromise;
  return loadPromise;
};

export { loadGoogleMaps3D };
