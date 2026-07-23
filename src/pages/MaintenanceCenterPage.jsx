import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSettings } from '../context/SettingsContext';
import { backbone, NodeTypes, habitService } from '../backbone-v2';
import './MaintenanceCenterPage.css';
import GlassPanel from '../components/ui/GlassPanel';
import {
    Shield,
    Search,
    X,
    Check,
    BookOpen,
    Target,
    TrendingUp,
    Settings,
    Compass,
    Layers,
    Plus,
    Terminal,
    Activity,
    Languages,
    Sparkles,
    Heart
} from 'lucide-react';
import { getSkillEngagementStatus } from '../utils/engagementUtils';

const getSkillIcon = (skill, allLifeAreas, size = 20) => {
    if (!skill) return <Plus size={size} strokeWidth={1.5} />;
    
    const parentArea = allLifeAreas.find(a => a.id === skill.parentId);
    const areaName = parentArea ? parentArea.name.toLowerCase() : '';
    const skillName = skill.name.toLowerCase();
    
    const combined = `${skillName} ${areaName}`;
    
    if (combined.includes('health') || combined.includes('fit') || combined.includes('gym') || combined.includes('sport') || combined.includes('body') || combined.includes('workout') || combined.includes('run')) {
        return <Activity size={size} strokeWidth={1.5} />;
    }
    if (combined.includes('code') || combined.includes('dev') || combined.includes('tech') || combined.includes('soft') || combined.includes('build') || combined.includes('saas') || combined.includes('system') || combined.includes('program')) {
        return <Terminal size={size} strokeWidth={1.5} />;
    }
    if (combined.includes('lang') || combined.includes('speak') || combined.includes('write') || combined.includes('read') || combined.includes('learn') || combined.includes('study') || combined.includes('chinese') || combined.includes('english') || combined.includes('spanish') || combined.includes('cantonese') || combined.includes('japanese') || combined.includes('french') || combined.includes('german') || combined.includes('廣東話')) {
        return <Languages size={size} strokeWidth={1.5} />;
    }
    if (combined.includes('mind') || combined.includes('medit') || combined.includes('spirit') || combined.includes('flow') || combined.includes('heart') || combined.includes('soul') || combined.includes('feel')) {
        return <Heart size={size} strokeWidth={1.5} />;
    }
    if (combined.includes('identity') || combined.includes('brand') || combined.includes('market') || combined.includes('media') || combined.includes('social') || combined.includes('x')) {
        return <Sparkles size={size} strokeWidth={1.5} />;
    }
    
    return <Target size={size} strokeWidth={1.5} />;
};

const MaintenanceCenterPage = () => {
    const {
        maintenanceSkillIds,
        updateMaintenanceSkillIds,
        focusSlots,
        loading: settingsLoading,
    } = useSettings();

    const [allSkills, setAllSkills] = useState([]);
    const [loadingSkills, setLoadingSkills] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const searchRef = useRef(null);

    const [allNodes, setAllNodes] = useState([]);
    const [allHabits, setAllHabits] = useState([]);

    const allLifeAreas = useMemo(() => {
        return allNodes.filter(n => n.type === NodeTypes.LIFE_AREA || n.type === 'LIFE_AREA');
    }, [allNodes]);

    useEffect(() => {
        const loadSkills = async () => {
            try {
                setLoadingSkills(true);
                await backbone.initialize();
                const [nodes, habits] = await Promise.all([
                    backbone.getAllNodes(),
                    habitService.getAllHabits()
                ]);

                setAllNodes(nodes);
                setAllHabits(habits);

                const skills = nodes.filter(n => n.type === NodeTypes.SKILL);
                // Sort skills: active (maintenance, focus, or marked ACTIVE) first, then alphabet
                const sortedSkills = [...skills].sort((a, b) => {
                    const aActive = maintenanceSkillIds.includes(a.id) || focusSlots.includes(a.id) || a.metadata?.status === 'ACTIVE';
                    const bActive = maintenanceSkillIds.includes(b.id) || focusSlots.includes(b.id) || b.metadata?.status === 'ACTIVE';
                    if (aActive && !bActive) return -1;
                    if (!aActive && bActive) return 1;
                    return a.name.localeCompare(b.name);
                });
                setAllSkills(sortedSkills);
            } catch (err) {
                console.error('[MaintenanceCenter] Failed to load skills:', err);
            } finally {
                setLoadingSkills(false);
            }
        };
        loadSkills();
    }, [maintenanceSkillIds]);

    const filteredSkills = allSkills.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Active if in focus slots OR explicitly marked ACTIVE (and not already in maintenance)
    const maintenanceSkillsArr = filteredSkills.filter(s => 
        maintenanceSkillIds.includes(s.id)
    );

    const activeFocusSkillsArr = filteredSkills.filter(s => 
        !maintenanceSkillIds.includes(s.id) && 
        (focusSlots.includes(s.id) || s.metadata?.status === 'ACTIVE')
    );

    // Everything else is sleeping
    const sleepingSkillsArr = filteredSkills.filter(s => 
        !maintenanceSkillIds.includes(s.id) && 
        !focusSlots.includes(s.id) && 
        s.metadata?.status !== 'ACTIVE'
    );

    const toggleMaintenanceSkill = (skillId) => {
        // Prevent maintenance if already in focus slots
        if (focusSlots.includes(skillId)) return;

        let newIds;
        if (maintenanceSkillIds.includes(skillId)) {
            newIds = maintenanceSkillIds.filter(id => id !== skillId);
        } else {
            newIds = [...maintenanceSkillIds, skillId];
        }
        updateMaintenanceSkillIds(newIds);
    };

    if (settingsLoading) {
        return (
            <div className="maintenance-center-loading">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div className="maintenance-center-container">
            <header className="maintenance-center-header">
                <div className="header-badge">
                    <Shield size={14} />
                    <span>Keep It Alive</span>
                </div>
                <h1>Maintenance Center</h1>
                <p>
                    Select the skills you want to keep on a pilot light. Doing their tiny maintenance habits keeps them warm and prevents them from cooling down to grey.
                </p>
                
                <div className="search-bar-container">
                    <div className="search-input-wrapper">
                        <Search size={18} className="search-icon" />
                        <input
                            ref={searchRef}
                            type="text"
                            placeholder="Search skills to maintain..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button className="clear-search" onClick={() => setSearchQuery('')}>
                                <X size={16} />
                            </button>
                        )}
                    </div>
                </div>
            </header>

            <div className="maintenance-sections">
                {loadingSkills ? (
                    <div className="grid-loading">Loading your skills...</div>
                ) : filteredSkills.length > 0 ? (
                    <>
                        {/* Maintenance Skills Section */}
                        {maintenanceSkillsArr.length > 0 && (
                            <div className="maintenance-section-group">
                                <h2 className="section-label">Maintenance Skills</h2>
                                <div className="skills-selection-grid">
                                    {maintenanceSkillsArr.map(skill => (
                                        <SkillCard 
                                            key={skill.id}
                                            skill={skill}
                                            isSelected={maintenanceSkillIds.includes(skill.id)}
                                            isFocus={focusSlots.includes(skill.id)}
                                            health={getSkillEngagementStatus(skill.id, allNodes, allHabits)}
                                            onToggle={toggleMaintenanceSkill}
                                            allLifeAreas={allLifeAreas}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Active Focus Skills Section */}
                        {activeFocusSkillsArr.length > 0 && (
                            <div className="maintenance-section-group">
                                <h2 className="section-label">Active Skills</h2>
                                <div className="skills-selection-grid">
                                    {activeFocusSkillsArr.map(skill => (
                                        <SkillCard 
                                            key={skill.id}
                                            skill={skill}
                                            isSelected={maintenanceSkillIds.includes(skill.id)}
                                            isFocus={focusSlots.includes(skill.id)}
                                            health={getSkillEngagementStatus(skill.id, allNodes, allHabits)}
                                            onToggle={toggleMaintenanceSkill}
                                            allLifeAreas={allLifeAreas}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Sleeping Skills Section */}
                        {sleepingSkillsArr.length > 0 && (
                            <div className="maintenance-section-group">
                                <h2 className="section-label">Sleeping Skills</h2>
                                <div className="skills-selection-grid">
                                    {sleepingSkillsArr.map(skill => (
                                        <SkillCard 
                                            key={skill.id}
                                            skill={skill}
                                            isSelected={maintenanceSkillIds.includes(skill.id)}
                                            isFocus={focusSlots.includes(skill.id)}
                                            health={getSkillEngagementStatus(skill.id, allNodes, allHabits)}
                                            onToggle={toggleMaintenanceSkill}
                                            allLifeAreas={allLifeAreas}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="no-skills-found">
                        No skills found matching "{searchQuery}"
                    </div>
                )}
            </div>
        </div>
    );
};

const SkillCard = ({ skill, isSelected, isFocus, health, onToggle, allLifeAreas }) => {
    return (
        <div
            className={`skill-selection-card ${isSelected ? 'selected' : ''} ${isFocus ? 'focus-protected' : ''}`}
            onClick={() => onToggle(skill.id)}
        >
            <div className="card-main-content">
                <div className="skill-icon-wrap">
                    {getSkillIcon(skill, allLifeAreas, 20)}
                    {health && (
                        <div className={`health-dot ${health.status}`} title={`Last engaged ${health.daysSince || 0} days ago`} />
                    )}
                </div>
                <div className="skill-details">
                    <div className="skill-name">{skill.name}</div>
                    <div className="skill-badges-row">
                        {isFocus && <div className="focus-badge">Obsessed With</div>}
                        {skill.metadata?.status === 'ACTIVE' && !isFocus && <div className="status-active-badge">Active</div>}
                    </div>
                </div>
            </div>

            <div className="card-selection-indicator">
                <div className={`checkbox-circle ${isSelected ? 'checked' : ''}`}>
                    {isSelected && <Check size={14} strokeWidth={3} />}
                </div>
            </div>
        </div>
    );
};

export default MaintenanceCenterPage;
