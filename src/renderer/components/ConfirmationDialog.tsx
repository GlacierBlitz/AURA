/**
 * ConfirmationDialog - Modal dialog for confirming sensitive actions
 * 
 * PERSON 3 TODO:
 * 1. Create modal dialog component with Escape to cancel
 * 2. Display action description and consequences
 * 3. Add Confirm/Cancel/Modify buttons
 * 4. Make fully keyboard accessible (Tab, Enter, Escape)
 * 5. Integrate with TTS to read confirmation message
 * 6. Send response via IPC when user decides
 */

import React, { useEffect, useRef } from 'react';
import '../styles/ConfirmationDialog.css';

export interface ConfirmationDialogProps {
  actionId: string;
  message: string;
  consequences: string[];
  canModify: boolean;
  suggestedModifications?: string[];
  onConfirm: () => void;
  onCancel: () => void;
  onModify?: () => void;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  actionId,
  message,
  consequences,
  canModify,
  suggestedModifications,
  onConfirm,
  onCancel,
  onModify
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // TODO: Focus confirm button on mount
    confirmButtonRef.current?.focus();

    // TODO: Add keyboard event listener for Escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onCancel]);

  // TODO: Integrate with TTS to read message aloud

  return (
    <div className="confirmation-overlay" onClick={onCancel}>
      <div
        ref={dialogRef}
        className="confirmation-dialog"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-labelledby="confirmation-title"
        aria-describedby="confirmation-description"
      >
        <h2 id="confirmation-title">Confirm Action</h2>
        
        <div id="confirmation-description" className="confirmation-content">
          <p className="confirmation-message">{message}</p>
          
          {consequences.length > 0 && (
            <div className="confirmation-consequences">
              <strong>⚠️ Warning:</strong>
              <ul>
                {consequences.map((consequence, index) => (
                  <li key={index}>{consequence}</li>
                ))}
              </ul>
            </div>
          )}

          {canModify && suggestedModifications && suggestedModifications.length > 0 && (
            <div className="confirmation-modifications">
              <strong>Suggested alternatives:</strong>
              <ul>
                {suggestedModifications.map((mod, index) => (
                  <li key={index}>{mod}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="confirmation-actions">
          <button
            ref={confirmButtonRef}
            className="btn-confirm"
            onClick={onConfirm}
            aria-label="Confirm action"
          >
            Confirm
          </button>
          
          {canModify && onModify && (
            <button
              className="btn-modify"
              onClick={onModify}
              aria-label="Modify action"
            >
              Modify
            </button>
          )}
          
          <button
            className="btn-cancel"
            onClick={onCancel}
            aria-label="Cancel action"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
