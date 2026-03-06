import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

const LastVisit = () => {
    const [timeSince, setTimeSince] = useState('');

    useEffect(() => {
        const STORAGE_KEY = 'warhead_last_visit';
        const lastVisit = localStorage.getItem(STORAGE_KEY);
        const now = Date.now();

        if (lastVisit) {
            const diff = now - parseInt(lastVisit, 10);
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

            if (hours >= 24) {
                const days = Math.floor(hours / 24);
                setTimeSince(`${days} day${days > 1 ? 's' : ''}`);
            } else if (hours > 0) {
                setTimeSince(`${hours} hour${hours > 1 ? 's' : ''}`);
            } else if (minutes > 0) {
                setTimeSince(`${minutes} minute${minutes > 1 ? 's' : ''}`);
            } else {
                setTimeSince('just now');
            }
        } else {
            setTimeSince('first time');
        }

        // Update last visit time
        localStorage.setItem(STORAGE_KEY, now.toString());
    }, []);

    if (!timeSince || timeSince === 'just now') return null;

    return (
        <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            fontSize: '13px',
            color: 'rgba(255,255,255,0.6)',
            fontWeight: '500',
            marginBottom: '8px'
        }}>
            <Clock size={14} />
            <span>Last visit: {timeSince} ago</span>
        </div>
    );
};

export default LastVisit;
