import { useEffect, useMemo, useRef, useState } from "react";
import { captureEvent } from "../../../analytics/posthog.js";
import { DEFAULT_MATCH_KEEP_BY_LANE } from "../../../lib/userPreferences.js";
import {
  buildIsoUftPostTree,
  buildShareUrl,
  formatIsoUftPost,
  getDefaultExcludedIds,
} from "../utils/isoUftPost";
import PublicTradeListToggle, { refreshPublicListOnCopy } from "./PublicTradeListToggle.jsx";

const PREFS_STORAGE_KEY = "isoUftPostPrefs";

function readStoredPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) {
      return { format: "shorthand", includeLink: true };
    }
    const parsed = JSON.parse(raw);
    return {
      format: parsed.format === "classic" ? "classic" : "shorthand",
      includeLink: parsed.includeLink !== false,
    };
  } catch {
    return { format: "shorthand", includeLink: true };
  }
}

function writeStoredPrefs(prefs) {
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore quota / private-mode failures.
  }
}

function getAllDescendantIds(node) {
  const ids = [];
  if (node.children) {
    for (const child of node.children) {
      ids.push(child.id);
      ids.push(...getAllDescendantIds(child));
    }
  }
  return ids;
}

export function getNodeCheckState(node, excludedIds) {
  if (node.line && (!node.children || node.children.length === 0)) {
    return excludedIds.has(node.id) ? "unchecked" : "checked";
  }

  const descendantIds = getAllDescendantIds(node);
  if (descendantIds.length === 0) {
    return excludedIds.has(node.id) ? "unchecked" : "checked";
  }

  if (excludedIds.has(node.id)) {
    return "unchecked";
  }

  const excludedCount = descendantIds.filter((id) => excludedIds.has(id)).length;
  if (excludedCount === 0) {
    return "checked";
  }
  if (excludedCount === descendantIds.length) {
    return "unchecked";
  }
  return "indeterminate";
}

function getDefaultCollapsedIds(tree) {
  const collapsed = new Set();
  for (const modeNode of tree) {
    for (const sectionNode of modeNode.children ?? []) {
      collapsed.add(sectionNode.id);
    }
  }
  return collapsed;
}

function IndeterminateCheckbox({ id, checkState, label, onChange }) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = checkState === "indeterminate";
    }
  }, [checkState]);

  return (
    <label className="collection-bulk-post-modal__tree-label">
      <input
        ref={inputRef}
        type="checkbox"
        id={id}
        checked={checkState === "checked"}
        onChange={onChange}
      />
      <span>{label}</span>
    </label>
  );
}

function PostTreeNode({ node, excludedIds, collapsedIds, onToggle, onToggleCollapse, depth = 1 }) {
  const checkState = getNodeCheckState(node, excludedIds);
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = hasChildren && !collapsedIds.has(node.id);

  return (
    <div className="collection-bulk-post-modal__tree-node">
      <div className="collection-bulk-post-modal__tree-row">
        {hasChildren ? (
          <button
            type="button"
            className="collection-bulk-post-modal__tree-toggle"
            aria-expanded={isExpanded}
            aria-label={`${isExpanded ? "Collapse" : "Expand"} ${node.label}`}
            onClick={() => onToggleCollapse(node.id)}
          >
            <span className="collection-bulk-post-modal__tree-chevron" aria-hidden="true" />
          </button>
        ) : (
          <span className="collection-bulk-post-modal__tree-toggle-spacer" aria-hidden="true" />
        )}
        <IndeterminateCheckbox
          id={`post-tree-${node.id}`}
          checkState={checkState}
          label={node.label}
          onChange={() => onToggle(node)}
        />
      </div>
      {hasChildren && isExpanded ? (
        <div className="collection-bulk-post-modal__tree-children">
          {node.children.map((child) => (
            <PostTreeNode
              key={child.id}
              node={child}
              excludedIds={excludedIds}
              collapsedIds={collapsedIds}
              onToggle={onToggle}
              onToggleCollapse={onToggleCollapse}
              depth={depth + 1}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export default function IsoUftPostModal({
  isOpen,
  onClose,
  entries,
  onCopied,
  onCopyError,
  matchKeep = DEFAULT_MATCH_KEEP_BY_LANE,
  shareId = null,
  ownerUid = null,
  displayName = "",
  discordHandle = "",
  onShareIdChange,
}) {
  const [excludedIds, setExcludedIds] = useState(() => new Set());
  const [collapsedIds, setCollapsedIds] = useState(() => new Set());
  const [format, setFormat] = useState(() => readStoredPrefs().format);
  const [includeLink, setIncludeLink] = useState(() => readStoredPrefs().includeLink);

  const { tree, skippedEntries } = useMemo(
    () => buildIsoUftPostTree(entries ?? [], { matchKeep, format }),
    [entries, matchKeep, format],
  );

  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      const prefs = readStoredPrefs();
      setFormat(prefs.format);
      setIncludeLink(prefs.includeLink);
      setExcludedIds(getDefaultExcludedIds());
      setCollapsedIds(getDefaultCollapsedIds(tree));
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, tree]);

  useEffect(() => {
    writeStoredPrefs({ format, includeLink });
  }, [format, includeLink]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleEsc = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  const footerUrl = includeLink ? buildShareUrl({ shareId }) : null;

  const previewText = useMemo(
    () => formatIsoUftPost(tree, excludedIds, { format, footerUrl }),
    [tree, excludedIds, format, footerUrl],
  );

  const handleToggleCollapse = (nodeId) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleToggle = (node) => {
    const state = getNodeCheckState(node, excludedIds);
    const idsToToggle = [node.id, ...getAllDescendantIds(node)];

    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (state === "checked" || state === "indeterminate") {
        for (const id of idsToToggle) {
          next.add(id);
        }
      } else {
        for (const id of idsToToggle) {
          next.delete(id);
        }
      }
      return next;
    });
  };

  const handleCopy = async () => {
    if (!previewText) {
      return;
    }

    try {
      await copyTextToClipboard(previewText);
      if (shareId && ownerUid) {
        try {
          await refreshPublicListOnCopy({
            ownerUid,
            publicShareId: shareId,
            displayName,
            discordHandle,
            entries,
            matchKeep,
          });
        } catch (refreshErr) {
          console.error("Failed to refresh public trade list on copy", refreshErr);
        }
      }
      captureEvent("iso_uft_copied", { format, includeLink });
      onCopied({ skippedEntries });
      onClose();
    } catch (err) {
      console.error("Failed to copy ISO/UFT post", err);
      onCopyError();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: full-screen modal backdrop; Escape closes via window listener
    // biome-ignore lint/a11y/useKeyWithClickEvents: dismiss is pointer-only; keyboard users use Escape
    <div
      className="collection-bulk-post-modal__backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      {/* biome-ignore lint/complexity/noUselessFragments: fragment isolates the next suppression from the dialog root */}
      <>
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: stops click bubbling to backdrop */}
        <div
          className="collection-bulk-post-modal"
          role="dialog"
          aria-modal="true"
          aria-label="ISO/UFT post preview"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="collection-bulk-post-modal__header">
            <h2>ISO/UFT post preview</h2>
            <p>Select sections to include, then copy the formatted post to your clipboard.</p>
          </div>

          <div className="collection-bulk-post-modal__options">
            <label className="collection-bulk-post-modal__option">
              <input
                type="checkbox"
                checked={includeLink}
                onChange={(event) => setIncludeLink(event.target.checked)}
              />
              <span>Include link to ShardStash</span>
            </label>
            <fieldset className="collection-bulk-post-modal__format">
              <legend>Format</legend>
              <label className="collection-bulk-post-modal__option">
                <input
                  type="radio"
                  name="iso-uft-format"
                  value="shorthand"
                  checked={format === "shorthand"}
                  onChange={() => setFormat("shorthand")}
                />
                <span>Community shorthand</span>
              </label>
              <label className="collection-bulk-post-modal__option">
                <input
                  type="radio"
                  name="iso-uft-format"
                  value="classic"
                  checked={format === "classic"}
                  onChange={() => setFormat("classic")}
                />
                <span>Classic</span>
              </label>
            </fieldset>
            {ownerUid ? (
              <PublicTradeListToggle
                ownerUid={ownerUid}
                displayName={displayName}
                discordHandle={discordHandle}
                entries={entries}
                matchKeep={matchKeep}
                publicShareId={shareId}
                onShareIdChange={onShareIdChange}
              />
            ) : null}
          </div>

          <div className="collection-bulk-post-modal__body">
            <div className="collection-bulk-post-modal__tree-pane">
              <h3 className="collection-bulk-post-modal__pane-title">Include in post</h3>
              <div className="collection-bulk-post-modal__tree">
                {tree.map((modeNode) => (
                  <PostTreeNode
                    key={modeNode.id}
                    node={modeNode}
                    excludedIds={excludedIds}
                    collapsedIds={collapsedIds}
                    onToggle={handleToggle}
                    onToggleCollapse={handleToggleCollapse}
                  />
                ))}
              </div>
            </div>

            <div className="collection-bulk-post-modal__preview-pane">
              <h3 className="collection-bulk-post-modal__pane-title">Preview</h3>
              <pre className="collection-bulk-post-modal__preview">{previewText}</pre>
            </div>
          </div>

          <div className="collection-bulk-post-modal__actions">
            <button
              type="button"
              className="collection-bulk-post-modal__button collection-bulk-post-modal__button--primary"
              onClick={handleCopy}
              disabled={!previewText}
            >
              Copy to clipboard
            </button>
            <button
              type="button"
              className="collection-bulk-post-modal__button collection-bulk-post-modal__button--secondary"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </div>
      </>
    </div>
  );
}
