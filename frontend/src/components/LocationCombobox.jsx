import { useEffect, useId, useMemo, useRef, useState } from "react";
import { buildLocationList, resolveLocationOption } from "../lib/matchLocations.js";
import "./LocationCombobox.css";

function optionDomId(listboxId, option) {
  return `${listboxId}-${option.code || "clear"}`;
}

export default function LocationCombobox({
  id,
  label,
  options,
  value,
  onValueChange,
  pinCode = "",
  clearLabel = "Not set",
  disabled = false,
}) {
  const listboxId = useId();
  const inputRef = useRef(null);
  const ignoreBlurRef = useRef(false);
  const editingRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const selected = options.find((option) => option.code === value);
  const selectedName = selected?.name ?? "";
  const filterText = open && editing ? query : "";
  const listOptions = useMemo(
    () => buildLocationList(options, filterText, { pinCode, clearLabel }),
    [options, filterText, pinCode, clearLabel],
  );
  const resolvedIndex =
    listOptions.length === 0 ? -1 : Math.min(Math.max(activeIndex, 0), listOptions.length - 1);
  const activeOption = resolvedIndex >= 0 ? listOptions[resolvedIndex] : null;

  useEffect(() => {
    if (!open || !activeOption) {
      return;
    }
    const node = document.getElementById(optionDomId(listboxId, activeOption));
    if (node && typeof node.scrollIntoView === "function") {
      node.scrollIntoView({ block: "nearest" });
    }
  }, [open, activeOption, listboxId]);

  const closeWithoutCommit = () => {
    editingRef.current = false;
    setEditing(false);
    setQuery("");
    setOpen(false);
  };

  const choose = (option) => {
    ignoreBlurRef.current = true;
    closeWithoutCommit();
    inputRef.current?.blur();
    if (option.code !== value) {
      onValueChange(option.code);
    }
  };

  const handleFocus = () => {
    if (disabled) {
      return;
    }
    editingRef.current = false;
    setEditing(false);
    setQuery("");
    setOpen(true);
    const list = buildLocationList(options, "", { pinCode, clearLabel });
    const selectedIndex = list.findIndex((option) => option.code === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  };

  const handleBlur = () => {
    if (ignoreBlurRef.current) {
      ignoreBlurRef.current = false;
      closeWithoutCommit();
      return;
    }

    const wasEditing = editingRef.current;
    const typed = query;
    closeWithoutCommit();
    if (!wasEditing) {
      return;
    }

    const trimmed = typed.trim();
    if (!trimmed || trimmed.toLowerCase() === clearLabel.trim().toLowerCase()) {
      if (value !== "") {
        onValueChange("");
      }
      return;
    }

    const match = resolveLocationOption(options, trimmed);
    if (match && match.code !== value) {
      onValueChange(match.code);
    }
  };

  const handleInputChange = (event) => {
    editingRef.current = true;
    setEditing(true);
    setQuery(event.target.value);
    setOpen(true);
    setActiveIndex(0);
  };

  const moveActive = (delta) => {
    if (listOptions.length === 0) {
      return;
    }
    const current = resolvedIndex < 0 ? 0 : resolvedIndex;
    setActiveIndex(Math.min(Math.max(current + delta, 0), listOptions.length - 1));
  };

  const handleKeyDown = (event) => {
    if (disabled) {
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        handleFocus();
        return;
      }
      moveActive(event.key === "ArrowDown" ? 1 : -1);
      return;
    }

    if (!open) {
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(Math.max(listOptions.length - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (activeOption) {
        choose(activeOption);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      ignoreBlurRef.current = true;
      closeWithoutCommit();
      inputRef.current?.blur();
    }
  };

  return (
    <div className="location-combobox">
      <input
        ref={inputRef}
        id={id}
        className="location-combobox__input"
        type="text"
        role="combobox"
        aria-label={label}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={
          open && activeOption ? optionDomId(listboxId, activeOption) : undefined
        }
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        placeholder={open ? "Type to filter" : clearLabel}
        value={open ? query : selectedName}
        disabled={disabled}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
      />
      {open ? (
        <div id={listboxId} className="location-combobox__list" role="listbox">
          {listOptions.length === 0 ? (
            <div className="location-combobox__empty">No matches</div>
          ) : (
            listOptions.map((option, index) => (
              <div
                key={option.code || "clear"}
                id={optionDomId(listboxId, option)}
                className="location-combobox__option"
                role="option"
                tabIndex={-1}
                aria-selected={option.code === value}
                data-active={index === resolvedIndex ? "true" : undefined}
                onPointerDown={(event) => {
                  event.preventDefault();
                }}
                onClick={() => choose(option)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    choose(option);
                  }
                }}
              >
                {option.name}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
