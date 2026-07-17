import { useEffect, useRef, useState } from "react";
import { IoIosClose } from "react-icons/io";
import searchIcon from "@/assets/icons/search.svg";
import { SearchResults } from "@/components/toolbar/SearchResults.tsx";
import { useAutofillSearchQuery } from "@/hooks/useAutofillSearchQuery.ts";
import { useNavigateLocationParams } from "@/hooks/useNavigateLocationParams.ts";
import { useNavPaths } from "@/hooks/useNavigationParams.ts";
import { useBoundStore } from "@/store/index.ts";
import type { SearchTarget } from "@/types/searchTypes.ts";

interface Props {
  mapRef: React.RefObject<mapkit.Map | null>;
}

const Searchbar = ({ mapRef }: Props) => {
  // Hooks
  const navigate = useNavigateLocationParams();

  const searchTargetText: Record<SearchTarget, string> = {
    "nav-src": "Search for Starting Location",
    "nav-dst": "Search for Destination",
  };

  // Global state
  const isSearchOpen = useBoundStore((state) => state.isSearchOpen);
  const showSearch = useBoundStore((state) => state.showSearch);
  const hideSearch = useBoundStore((state) => state.hideSearch);
  const searchTarget = useBoundStore((state) => state.searchTarget);
  const setSearchTarget = useBoundStore((state) => state.setSearchTarget);
  const isNavigating = useBoundStore((state) => state.isNavigating);

  // Local state
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Custom Hook
  useAutofillSearchQuery(setSearchQuery);
  const { isNavOpen } = useNavPaths();

  // Blur the input field when not searching (mainly used for clicking on the map to close search)
  useEffect(() => {
    if (!isSearchOpen && inputRef.current) {
      inputRef.current.blur();
    }
  }, [isSearchOpen]);

  // keydown event listener
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (inputRef.current) {
        // focus on the input if command f is pressed
        if ((event.metaKey || event.ctrlKey) && event.key === "f") {
          showSearch();
          inputRef.current.focus();
          event.preventDefault();
        }

        // close search if escape is pressed
        if (event.key === "Escape") {
          hideSearch();
          navigate("/");
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate, hideSearch, showSearch]);

  useEffect(() => {
    if (searchTarget) {
      inputRef.current?.focus();
      setSearchQuery("");
    }
  }, [searchTarget]);

  useEffect(() => {
    if (!isNavOpen) {
      setSearchTarget(undefined);
    }
  }, [isNavOpen, setSearchTarget]);

  // Hide searchbar if navigating, unless selecting a destination or source
  if (isNavOpen || isNavigating) {
    return;
  }

  const renderSearchIcon = () => (
    <img alt="Search Icon" src={searchIcon} className="ml-4" width={20} />
  );

  const renderInput = () => (
    <input
      type="text"
      className="w-full rounded p-2 pr-6 outline-none"
      placeholder={searchTarget ? searchTargetText[searchTarget] : "Search..."}
      ref={inputRef}
      value={searchQuery}
      onChange={(event) => {
        setSearchQuery(event.target.value);
      }}
      title="Search query"
      onFocus={() => {
        showSearch();
      }}
    />
  );

  const renderCloseButton = () => (
    <IoIosClose
      title="Close"
      size={30}
      className="w-auto shrink-0 pr-2"
      onClick={() => {
        if (searchQuery === "") {
          setSearchTarget(undefined);
        }
        setSearchQuery("");
        hideSearch();
        navigate("/");
      }}
    />
  );

  return (
    <div className="flex flex-col">
      <div className="flex">
        <div className="z-50 mb-2 flex w-full shrink-0 items-center overflow-hidden rounded-full bg-white shadow-[1px_4px_4px_0_rgba(0,0,0,0.15)]">
          {renderSearchIcon()}
          {renderInput()}
          {(isSearchOpen || searchQuery.length > 0) && renderCloseButton()}
        </div>
      </div>
      {isSearchOpen && (
        <div className="h-100 overflow-y-scroll rounded-lg">
          <SearchResults mapRef={mapRef} searchQuery={searchQuery} />
        </div>
      )}
    </div>
  );
};

export { Searchbar };
