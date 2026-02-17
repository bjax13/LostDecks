import { useEffect, useMemo, useState } from 'react';
import { useAddToCollection } from '../hooks/useAddToCollection';
import { useAuthModal } from '../../../contexts/AuthModalContext.jsx';

const successMessage = 'Added to your collection!';
const errorMessage = "Couldn't add collectible. Please try again.";

function formatFinishLabel(finish) {
  if (!finish || typeof finish !== 'string') {
    return '';
  }
  const lower = finish.toLowerCase();
  return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
}

export default function AddToCollectionButton({ collectible, card, variant = 'card' }) {
  const item = collectible ?? card;
  const { addToCollection, status, error, user, reset } = useAddToCollection();
  const { openAuthModal } = useAuthModal();
  const [feedback, setFeedback] = useState(null);
  const [pendingFinish, setPendingFinish] = useState(null);
  const [lastFinish, setLastFinish] = useState(null);

  const finishes = useMemo(() => item?.finishes ?? [], [item]);
  const availableFinishes = useMemo(
    () =>
      finishes.reduce((acc, finish) => {
        acc[finish] = true;
        return acc;
      }, {}),
    [finishes],
  );

  useEffect(() => {
    if (!item) return;
    setFeedback(null);
    setPendingFinish(null);
    setLastFinish(null);
    reset();
  }, [item?.id, reset]);

  useEffect(() => {
    if (status === 'success') {
      const finishLabel = lastFinish ? formatFinishLabel(lastFinish) : null;
      setFeedback({
        type: 'success',
        message: finishLabel
          ? `Added ${finishLabel} to your collection!`
          : successMessage,
      });
      const timer = setTimeout(() => {
        setFeedback(null);
        reset();
      }, 2500);
      return () => clearTimeout(timer);
    }

    if (status === 'error') {
      setFeedback({ type: 'error', message: errorMessage });
    }

    return undefined;
  }, [status, reset, lastFinish]);

  useEffect(() => () => reset(), [reset]);

  useEffect(() => {
    if (status !== 'loading') {
      setPendingFinish(null);
    }
  }, [status]);

  const handleAdd = async (finish) => {
    if (!item) return;

    if (!user) {
      openAuthModal({ reason: 'add-to-collection' });
      return;
    }

    try {
      setPendingFinish(finish);
      setLastFinish(finish);
      setFeedback(null);
      await addToCollection({
        card: item,
        finish: finish ?? null,
        quantity: 1,
      });
    } catch (err) {
      if (err?.code === 'auth-required') {
        openAuthModal({ reason: 'add-to-collection' });
      } else {
        setFeedback({ type: 'error', message: errorMessage });
      }
    }
  };

  const isLoading = status === 'loading';
  const finishButtons = useMemo(
    () =>
      ['DUN', 'FOIL']
        .filter((finish) => availableFinishes[finish])
        .map((finish) => ({
          finish,
          label: formatFinishLabel(finish),
        })),
    [availableFinishes],
  );

  return (
    <div className={`add-to-collection add-to-collection--${variant}`}>
      {finishButtons.length > 0 ? (
        <div className="add-to-collection__buttons">
          {finishButtons.map(({ finish, label }) => (
            <button
              key={finish}
              type="button"
              className="add-to-collection__button"
              onClick={() => handleAdd(finish)}
              disabled={isLoading}
            >
              {isLoading && pendingFinish === finish
                ? `Adding ${label}…`
                : `Add ${label}`}
            </button>
          ))}
        </div>
      ) : (
        <span className="add-to-collection__feedback add-to-collection__feedback--details">
          No finishes available
        </span>
      )}

      {feedback ? (
        <span
          className={`add-to-collection__feedback add-to-collection__feedback--${feedback.type}`}
        >
          {feedback.message}
        </span>
      ) : null}

      {status === 'error' && error?.code && error.code !== 'auth-required' ? (
        <span className="add-to-collection__feedback add-to-collection__feedback--error add-to-collection__feedback--details">
          {error.message ?? 'Unexpected error'}
        </span>
      ) : null}
    </div>
  );
}
