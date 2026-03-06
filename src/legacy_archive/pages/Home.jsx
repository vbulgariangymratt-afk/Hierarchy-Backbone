import { useNavigate } from 'react-router-dom';
import { useGlassClass } from '../hooks/useGlassClass';
import TimeInvestedWidget from '../components/TimeInvestedWidget';
import DashboardStats from '../components/DashboardStats';
import ProgressRings from '../components/ProgressRings';
import RecentAchievements from '../components/RecentAchievements';
import LastVisit from '../components/LastVisit';
import UpcomingItems from '../components/UpcomingItems';
import EnhancedWarheadInsights from '../components/EnhancedWarheadInsights';
import ScheduledRestWidget from '../components/ScheduledRestWidget';
import { useState, useEffect } from 'react';

const Home = () => {
    const navigate = useNavigate();
    const glassClass = useGlassClass();
    const [isVisible, setIsVisible] = useState(false);

    // Trigger entrance animations on mount
    useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), 50);
        return () => clearTimeout(timer);
    }, []);

    // Get random casual greeting
    const getGreeting = () => {
        const greetings = [
            "What's up",
            "Hey there",
            "How's it going",
            "Welcome back",
            "Good to see you",
            "Yo",
            "Howdy",
            "What's good",
            "Sup",
            "Greetings",
            "Hello",
            "Hi there",
            "Hey",
            "Look who's back"
        ];
        return greetings[Math.floor(Math.random() * greetings.length)];
    };

    return (
        <div style={{ paddingBottom: '40px' }}>
            {/* Premium Hero Section with Outfit Font */}
            <div style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(-10px)',
                transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                marginBottom: '32px'
            }}>
                <LastVisit />
                <h1 style={{
                    fontFamily: "'Outfit', sans-serif",
                    fontSize: '48px',
                    fontWeight: '700',
                    letterSpacing: '-0.03em',
                    marginBottom: '8px',
                    background: 'linear-gradient(135deg, #FFFFFF 0%, rgba(255, 255, 255, 0.7) 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    lineHeight: '1.1'
                }}>
                    {getGreeting()}, Max
                </h1>
                <p style={{
                    color: 'rgba(255, 255, 255, 0.5)',
                    fontSize: '16px',
                    fontWeight: '400',
                    letterSpacing: '-0.01em'
                }}>
                    Here is your daily overview.
                </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Scheduled Rest Support Layer */}
                <div style={{
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
                    transition: 'all 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.05s'
                }}>
                    <ScheduledRestWidget />
                </div>

                {/* Quick Stats Dashboard - Staggered Animation */}
                <div style={{
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
                    transition: 'all 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.1s'
                }}>
                    <DashboardStats />
                </div>

                {/* Two Column Layout: Progress Ring + Achievements */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '16px',
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
                    transition: 'all 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.2s'
                }}>
                    <ProgressRings />
                    <RecentAchievements />
                </div>

                {/* Enhanced Warhead Insights - Staggered Animation */}
                <div style={{
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
                    transition: 'all 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.3s',
                    marginBottom: '-14px'
                }}>
                    <EnhancedWarheadInsights />
                </div>

                {/* Time Invested Section - Staggered Animation */}
                <div style={{
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
                    transition: 'all 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.4s'
                }}>
                    <TimeInvestedWidget />
                </div>

                {/* Upcoming Items - Staggered Animation */}
                <div style={{
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
                    transition: 'all 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.5s'
                }}>
                    <UpcomingItems />
                </div>
            </div>

        </div>
    );
};

export default Home;
