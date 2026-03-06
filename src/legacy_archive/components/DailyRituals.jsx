import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { getTodayString } from '../utils/dateUtils';
import { Sunrise, Sunset } from 'lucide-react';

const DailyRituals = () => {
    const { state, updateJournal } = useStore();
    const [showMorning, setShowMorning] = useState(false);
    const [showEvening, setShowEvening] = useState(false);

    const today = getTodayString();
    const entry = (state.journal || {})[today] || {};
    const rituals = entry.rituals || {};

    useEffect(() => {
        const checkRituals = () => {
            const now = new Date();
            const hours = now.getHours();

            // Morning Check-in: after 4 AM, if not done today
            if (hours >= 4 && hours < 21 && !rituals.morningCheckedIn) {
                setShowMorning(true);
            } else {
                setShowMorning(false);
            }

            // Evening Shutdown: after 9 PM, if not done today
            if (hours >= 21 && !rituals.eveningShutdownDone) {
                setShowEvening(true);
            } else {
                setShowEvening(false);
            }
        };

        if (state.isLoaded) {
            checkRituals();
            const timer = setInterval(checkRituals, 60000); // Check every minute
            return () => clearInterval(timer);
        }
    }, [rituals.morningCheckedIn, rituals.eveningShutdownDone, state.isLoaded]);

    if (!showMorning && !showEvening) return null;

    const handleMorningSubmit = (data) => {
        updateJournal(today, {
            rituals: { ...rituals, morningCheckedIn: true, ...data }
        });
        setShowMorning(false);
    };

    const handleEveningSubmit = (data) => {
        updateJournal(today, {
            rituals: { ...rituals, eveningShutdownDone: true, ...data }
        });
        setShowEvening(false);
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(20px)'
        }}>
            {showMorning && (
                <MorningForm onSubmit={handleMorningSubmit} />
            )}
            {showEvening && !showMorning && (
                <EveningForm onSubmit={handleEveningSubmit} />
            )}
        </div>
    );
};

const MorningForm = ({ onSubmit }) => {
    const [sleepStart, setSleepStart] = useState('');
    const [wakeTime, setWakeTime] = useState('');

    return (
        <div style={{
            background: 'rgba(255,255,255,0.03)',
            padding: '40px',
            borderRadius: '24px',
            width: '400px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Sunrise color="#ffcc00" size={32} />
                <h2 style={{ color: 'white', margin: 0, fontSize: '24px', fontWeight: '600' }}>Morning Check-in</h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                    <label style={{ display: 'block', color: 'rgba(255,255,255,0.5)', marginBottom: '8px', fontSize: '13px' }}>Arrival at sleep (last night)</label>
                    <input
                        type="time"
                        value={sleepStart}
                        onChange={e => setSleepStart(e.target.value)}
                        style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'rgba(0,0,0,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}
                    />
                </div>
                <div>
                    <label style={{ display: 'block', color: 'rgba(255,255,255,0.5)', marginBottom: '8px', fontSize: '13px' }}>Wake time (today)</label>
                    <input
                        type="time"
                        value={wakeTime}
                        onChange={e => setWakeTime(e.target.value)}
                        style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'rgba(0,0,0,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}
                    />
                </div>
            </div>

            <button
                onClick={() => onSubmit({ sleepStart, wakeTime })}
                disabled={!sleepStart || !wakeTime}
                style={{
                    background: '#ffcc00',
                    color: '#000',
                    fontWeight: '700',
                    padding: '16px',
                    borderRadius: '12px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '16px',
                    opacity: (!sleepStart || !wakeTime) ? 0.5 : 1
                }}
            >
                Begin Day
            </button>
        </div>
    );
};

const EveningForm = ({ onSubmit }) => {
    const [energyLevel, setEnergyLevel] = useState(5);
    const [anxietyLevel, setAnxietyLevel] = useState(5);
    const [dailyWin, setDailyWin] = useState('');
    const [intendedSleepTime, setIntendedSleepTime] = useState('');

    return (
        <div style={{
            background: 'rgba(255,255,255,0.03)',
            padding: '40px',
            borderRadius: '24px',
            width: '450px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Sunset color="#ff6600" size={32} />
                <h2 style={{ color: 'white', margin: 0, fontSize: '24px', fontWeight: '600' }}>Evening Shutdown</h2>
            </div>

            <div style={{ display: 'flex', gap: '24px' }}>
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>Energy</label>
                        <span style={{ color: '#ff6600', fontSize: '13px', fontWeight: 'bold' }}>{energyLevel}</span>
                    </div>
                    <input type="range" min="0" max="10" value={energyLevel} onChange={e => setEnergyLevel(e.target.value)} style={{ width: '100%', accentColor: '#ff6600' }} />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>Anxiety</label>
                        <span style={{ color: '#ff6600', fontSize: '13px', fontWeight: 'bold' }}>{anxietyLevel}</span>
                    </div>
                    <input type="range" min="0" max="10" value={anxietyLevel} onChange={e => setAnxietyLevel(e.target.value)} style={{ width: '100%', accentColor: '#ff6600' }} />
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                    <label style={{ display: 'block', color: 'rgba(255,255,255,0.5)', marginBottom: '8px', fontSize: '13px' }}>Today's Big Win</label>
                    <input
                        type="text"
                        placeholder="One achievement that defined today..."
                        value={dailyWin}
                        onChange={e => setDailyWin(e.target.value)}
                        style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'rgba(0,0,0,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}
                    />
                </div>
                <div>
                    <label style={{ display: 'block', color: 'rgba(255,255,255,0.5)', marginBottom: '8px', fontSize: '13px' }}>Intended Sleep Time</label>
                    <input
                        type="time"
                        value={intendedSleepTime}
                        onChange={e => setIntendedSleepTime(e.target.value)}
                        style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'rgba(0,0,0,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}
                    />
                </div>
            </div>

            <button
                onClick={() => onSubmit({ energyLevel, anxietyLevel, dailyWin, intendedSleepTime })}
                disabled={!dailyWin || !intendedSleepTime}
                style={{
                    background: '#ff6600',
                    color: 'white',
                    fontWeight: '700',
                    padding: '16px',
                    borderRadius: '12px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '16px',
                    opacity: (!dailyWin || !intendedSleepTime) ? 0.5 : 1
                }}
            >
                Secure Shutdown
            </button>
        </div>
    );
};

export default DailyRituals;
