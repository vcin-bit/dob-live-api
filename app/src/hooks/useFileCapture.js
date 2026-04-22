import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * useFileCapture — renders a file input via React Portal at document.body level,
 * outside any position:fixed modal stacking context.
 *
 * This fixes the Chrome Android dark screen bug where the camera opens behind
 * a fixed modal overlay and fails to repaint the WebView correctly.
 *
 * Usage:
 *   const { CaptureInput, triggerCapture } = useFileCapture({
 *     accept: 'image/*,video/*',
 *     onChange: (files) => handleFiles(files),
 *   });
 *
 *   // In JSX: render CaptureInput anywhere (it portals to body)
 *   // Call triggerCapture() from your button/label onClick
 */
export function useFileCapture({ accept = 'image/*', onChange }) {
  const inputRef = useRef(null);

  const triggerCapture = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.value = ''; // reset so same file can be re-selected
      inputRef.current.click();
    }
  }, []);

  const handleChange = useCallback((e) => {
    const files = Array.from(e.target.files || []);
    if (files.length && onChange) onChange(files);
    e.target.value = '';
  }, [onChange]);

  // The portal input — rendered at document.body, outside any stacking context
  const CaptureInput = createPortal(
    <input
      ref={inputRef}
      type="file"
      accept={accept}
      capture="environment"
      style={{ position: 'fixed', top: -9999, left: -9999, opacity: 0, width: 1, height: 1 }}
      onChange={handleChange}
    />,
    document.body
  );

  return { CaptureInput, triggerCapture };
}
