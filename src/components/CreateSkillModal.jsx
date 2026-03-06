import React from 'react';

const CreateSkillModal = ({ isOpen, onClose, onSuccess }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="create-skill-modal" onClick={e => e.stopPropagation()}>
                <h2>Create Skill</h2>
                <div style={{ padding: '20px', textAlign: 'center', opacity: 0.7 }}>
                    Skill creation is currently handled inline in AreaPage.
                </div>
                <button onClick={onClose}>Close</button>
            </div>
        </div>
    );
};

export default CreateSkillModal;
