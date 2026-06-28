import React from 'react';
import { useBackboneStore } from '../store/backboneStore';
import './UndoSnackbar.css';

export default function UndoSnackbar() {
    const { undoToast, clearUndoToast } = useBackboneStore();

    if (!undoToast) return null;

    const handleUndo = () => {
        if (undoToast.onUndo) {
            undoToast.onUndo();
        }
        clearUndoToast();
    };

    return (
        <div className="undo-snackbar-container">
            <div className="undo-snackbar capsule-shadow spring-transition">
                <span className="undo-message">{undoToast.message}</span>
                <button 
                    className="undo-btn neuro-btn" 
                    onClick={handleUndo}
                    aria-label="Undo action"
                >
                    Undo
                </button>
                <button 
                    className="undo-dismiss-btn" 
                    onClick={clearUndoToast}
                    aria-label="Dismiss"
                >
                    &times;
                </button>
            </div>
        </div>
    );
}
