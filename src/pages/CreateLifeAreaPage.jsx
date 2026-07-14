import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { backbone, NodeTypes } from '../backbone-v2/index';
import { useSettings } from '../context/SettingsContext';
import './CreateLifeAreaPage.css';

const CreateLifeAreaPage = () => {
    const navigate = useNavigate();
    const { focusSlots, updateFocusSlot, maintenanceSkillIds, updateMaintenanceSkillIds } = useSettings();
    
    // Step state: 1 = Life Area, 2 = Skill, 3 = Experiment, 4 = Aspect, 5 = Task
    const [step, setStep] = useState(1);
    
    // Form fields
    const [areaName, setAreaName] = useState('');
    const [skillName, setSkillName] = useState('');
    const [skillRestName, setSkillRestName] = useState('');
    const [priority, setPriority] = useState('Active'); // Focus, Active, Maintenance, Sleeping
    const [selectedVerb, setSelectedVerb] = useState(null);
    const [experimentName, setExperimentName] = useState('');
    const [hasDeadline, setHasDeadline] = useState(null); // null, 'no', 'yes'
    const [deadlineDate, setDeadlineDate] = useState('');
    const [aspectDumpText, setAspectDumpText] = useState('');
    const [aspectNames, setAspectNames] = useState([]);
    const [existingAspects, setExistingAspects] = useState([]);
    const [aspectStep, setAspectStep] = useState('dump'); // 'dump' or 'select'
    const [selectedAspect, setSelectedAspect] = useState('');
    const [taskDumpText, setTaskDumpText] = useState('');
    const [showKeepDumpingPrompt, setShowKeepDumpingPrompt] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Saved database IDs for looping wizard logic
    const [savedAreaId, setSavedAreaId] = useState(null);
    const [savedSkillId, setSavedSkillId] = useState(null);
    const [savedExperimentId, setSavedExperimentId] = useState(null);

    // Load existing aspects from database
    useEffect(() => {
        if (step === 4 && aspectStep === 'select' && savedExperimentId) {
            const load = async () => {
                try {
                    const allNodes = await backbone.getAllNodes();
                    const aspects = allNodes.filter(n => n.type === NodeTypes.ASPECT && n.parentId === savedExperimentId);
                    setExistingAspects(aspects.map(a => a.name));
                } catch (err) {
                    console.error("Failed to load existing aspects:", err);
                }
            };
            load();
        }
    }, [step, aspectStep, savedExperimentId]);

    const skillInputRef = useRef(null);

    const defaultAreas = [
        "Becoming an actually functional business owner",
        "I am becoming a polyglot.",
        "I’m getting jacked asfck"
    ];

    const quickStartVerbs = ["Building", "Practicing", "Maintaining", "Exploring"];
    const priorities = ["Focus", "Active", "Maintenance", "Sleeping"];

    // Verb Auto-fill Logic
    const handleVerbClick = (verb) => {
        setSelectedVerb(verb);
        let currentText = skillRestName || skillName;
        // Strip out existing verbs if they exist at the start of the string
        const verbs = ["Building", "Practicing", "Maintaining", "Exploring"];
        const foundVerb = verbs.find(v => currentText.toLowerCase().startsWith(v.toLowerCase()));
        if (foundVerb) {
            currentText = currentText.slice(foundVerb.length).trim();
        }
        setSkillRestName(currentText);

        // Autofocus input
        setTimeout(() => {
            if (skillInputRef.current) {
                skillInputRef.current.focus();
            }
        }, 0);
    };

    const handleFinalSave = async (options = {}) => {
        const {
            areaNameToSave = areaName,
            skillNameToSave = selectedVerb ? (selectedVerb + " " + skillRestName) : skillName,
            experimentNameToSave = experimentName,
            deadlineDateToSave = deadlineDate,
            aspectNamesToSave = aspectNames,
            selectedAspectToSave = selectedAspect,
            taskNamesToSave = [],
            redirectTo = '/launchpad',
            redirectState = null,
            loopToStep = null
        } = options;

        const areaClean = areaNameToSave?.trim();
        const skillClean = skillNameToSave?.trim();
        const experimentClean = experimentNameToSave?.trim();
        
        if (!areaClean) return;
        setIsSaving(true);

        const createdTaskIds = [];

        try {
            // 1. Create and save Life Area Node
            let areaId = savedAreaId;
            if (!areaId) {
                areaId = Math.random().toString(36).substr(2, 9);
                await backbone.addNode({
                    id: areaId,
                    name: areaClean,
                    type: 'LIFE_AREA',
                    parentId: null,
                    metadata: {}
                });
                setSavedAreaId(areaId);
            }

            // 2. Create and save Skill Node (if provided)
            let skillId = savedSkillId;
            if (skillClean && !skillId) {
                skillId = Math.random().toString(36).substr(2, 9);
                const savedSkill = await backbone.addNode({
                    id: skillId,
                    name: skillClean,
                    type: 'SKILL',
                    parentId: areaId,
                    metadata: {
                        identityTier: 'CORE',
                        status: priority === 'Sleeping' ? 'SLEEPING' : 'ACTIVE',
                        isActive: priority === 'Focus' || priority === 'Active',
                        activatedAt: (priority === 'Focus' || priority === 'Active') ? Date.now() : null,
                        iconUrl: null
                    }
                });

                if (savedSkill) {
                    // Apply Priority Side Effects
                    if (priority === 'Focus') {
                        // Find first empty focus slot (null)
                        const emptySlotIdx = focusSlots.findIndex(s => s === null);
                        if (emptySlotIdx !== -1) {
                            updateFocusSlot(emptySlotIdx, skillId);
                        } else {
                            // If all slots are full, replace the last one (standard flex slot)
                            updateFocusSlot(4, skillId);
                        }
                    } else if (priority === 'Maintenance') {
                        // Add to maintenance skill IDs
                        updateMaintenanceSkillIds([...maintenanceSkillIds, skillId]);
                    }
                }
                setSavedSkillId(skillId);
            }

            // 3. Create and save Experiment Node
            let expId = savedExperimentId;
            if (experimentClean && skillId && !expId) {
                let durationInDays = null;
                if (deadlineDateToSave) {
                    const diffTime = new Date(deadlineDateToSave) - new Date();
                    durationInDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
                }

                expId = Math.random().toString(36).substr(2, 9);
                await backbone.addNode({
                    id: expId,
                    type: NodeTypes.OBJECTIVE,
                    parentId: skillId,
                    name: experimentClean,
                    metadata: {
                        status: 'ACTIVE',
                        isActive: true,
                        isSleeping: false,
                        isArchived: false,
                        activatedAt: Date.now(),
                        theme: '',
                        durationInDays: durationInDays,
                        accumulationType: 'tasks or activities',
                        mve: '',
                        wish: '',
                        outcome: '',
                        iconUrl: '',
                        masterAccumulatedMetric: 0
                    }
                });
                setSavedExperimentId(expId);
            }

            // 4. Create and save Aspects & Tasks
            if (expId) {
                if (aspectNamesToSave && aspectNamesToSave.length > 0) {
                    for (const aspectName of aspectNamesToSave) {
                        const isFocus = aspectName === selectedAspectToSave;
                        const aspId = Math.random().toString(36).substr(2, 9);
                        await backbone.addNode({
                            id: aspId,
                            type: NodeTypes.ASPECT,
                            name: aspectName,
                            parentId: expId,
                            metadata: {
                                isFocus
                            }
                        });

                        // Create tasks under the selected focus aspect
                        if (isFocus && taskNamesToSave && taskNamesToSave.length > 0) {
                            for (const taskName of taskNamesToSave) {
                                const taskId = Math.random().toString(36).substr(2, 9);
                                await backbone.addNode({
                                    id: taskId,
                                    type: NodeTypes.TASK,
                                    name: taskName,
                                    parentId: aspId,
                                    metadata: {
                                        status: 'NOT_STARTED'
                                    }
                                });
                                createdTaskIds.push(taskId);
                            }
                        }
                    }
                } else {
                    // Fallback Aspect
                    const defaultAspId = Math.random().toString(36).substr(2, 9);
                    await backbone.addNode({
                        id: defaultAspId,
                        type: NodeTypes.ASPECT,
                        name: 'General',
                        parentId: expId,
                        metadata: {}
                    });
                }
            }
        } catch (err) {
            console.error('Failed to save hierarchy nodes:', err);
        } finally {
            setIsSaving(false);
            if (loopToStep) {
                if (loopToStep === 4) {
                    // Reset aspect step
                    setAspectDumpText('');
                    setAspectNames([]);
                    setAspectStep('dump');
                    setSelectedAspect('');
                    setTaskDumpText('');
                    setShowKeepDumpingPrompt(false);
                    setStep(4);
                } else if (loopToStep === 2) {
                    // Reset skill, experiment, and aspect step
                    setSkillName('');
                    setSkillRestName('');
                    setSelectedVerb(null);
                    setExperimentName('');
                    setHasDeadline(null);
                    setDeadlineDate('');
                    setAspectDumpText('');
                    setAspectNames([]);
                    setAspectStep('dump');
                    setSelectedAspect('');
                    setTaskDumpText('');
                    setShowKeepDumpingPrompt(false);
                    setStep(2);
                }
            } else {
                let finalRedirectState = redirectState;
                if (redirectTo === '/focus' && createdTaskIds.length > 0) {
                    finalRedirectState = { taskId: createdTaskIds[0] };
                }
                if (finalRedirectState) {
                    navigate(redirectTo, { state: finalRedirectState });
                } else {
                    navigate(redirectTo);
                }
            }
        }
    };

    const handleStep1Submit = () => {
        if (areaName.trim()) {
            setStep(2);
        }
    };

    const handleStep1KeyDown = (e) => {
        if (e.key === 'Enter' && areaName.trim()) {
            handleStep1Submit();
        }
    };

    const handleStep2Submit = () => {
        const checkValue = selectedVerb ? skillRestName : skillName;
        if (checkValue.trim()) {
            setStep(3);
        }
    };

    const handleStep2KeyDown = (e) => {
        const checkValue = selectedVerb ? skillRestName : skillName;
        if (e.key === 'Enter' && checkValue.trim()) {
            handleStep2Submit();
        }
    };

    const handleStep3Submit = (deadlineDateToUse = null) => {
        if (experimentName.trim()) {
            setDeadlineDate(deadlineDateToUse);
            setStep(4);
        }
    };

    const handleStep3KeyDown = (e) => {
        if (e.key === 'Enter' && experimentName.trim()) {
            handleStep3Submit(null);
        }
    };

    const handleSafeExit = () => {
        const finalSkill = selectedVerb ? (selectedVerb + " " + skillRestName) : skillName;
        if (step === 1) {
            if (areaName.trim()) {
                handleFinalSave({ areaNameToSave: areaName, skillNameToSave: '', experimentNameToSave: '', deadlineDateToSave: null, aspectNamesToSave: [], selectedAspectToSave: '' });
            } else {
                navigate('/launchpad');
            }
        } else if (step === 2) {
            handleFinalSave({ areaNameToSave: areaName, skillNameToSave: finalSkill, experimentNameToSave: '', deadlineDateToSave: null, aspectNamesToSave: [], selectedAspectToSave: '' });
        } else if (step === 3) {
            handleFinalSave({ areaNameToSave: areaName, skillNameToSave: finalSkill, experimentNameToSave: experimentName, deadlineDateToSave: deadlineDate, aspectNamesToSave: [], selectedAspectToSave: '' });
        } else if (step === 4) {
            const parsed = aspectDumpText.split(/,|\n/).map(s => s.trim()).filter(Boolean);
            handleFinalSave({ areaNameToSave: areaName, skillNameToSave: finalSkill, experimentNameToSave: experimentName, deadlineDateToSave: deadlineDate, aspectNamesToSave: parsed, selectedAspectToSave: '' });
        } else if (step === 5) {
            const parsedTasks = taskDumpText.split(/,|\n/).map(t => t.trim()).filter(Boolean);
            handleFinalSave({ areaNameToSave: areaName, skillNameToSave: finalSkill, experimentNameToSave: experimentName, deadlineDateToSave: deadlineDate, aspectNamesToSave: aspectNames, selectedAspectToSave: selectedAspect, taskNamesToSave: parsedTasks });
        }
    };

    const parsedTasks = taskDumpText.split(/,|\n/).map(t => t.trim()).filter(Boolean);
    const showButtons = parsedTasks.length >= 2;

    return (
        <div className="create-area-page-wrapper">
            <div className="create-area-container">
                
                {/* Persistent Scaffolding Progress Indicator */}
                <div className="create-area-header">
                    <span className="progress-text">
                        {step === 1 ? "1 of 5 levels complete" : step === 2 ? "2 of 5 levels complete" : step === 3 ? "3 of 5 levels complete" : step === 4 ? "4 of 5 levels complete" : "5 of 5 levels complete!"}
                    </span>
                    <div className="progress-bar-track">
                        <div 
                            className="progress-bar-fill" 
                            style={{ width: step === 1 ? '20%' : step === 2 ? '40%' : step === 3 ? '60%' : step === 4 ? '80%' : '100%' }}
                        />
                    </div>
                </div>

                {step === 1 ? (
                    /* STEP 1: LIFE AREA */
                    <>
                        <div className="create-area-header">
                            <h1 className="prompt-title">Who are you becoming?</h1>
                        </div>

                        <div className="defaults-grid">
                            {defaultAreas.map((option, idx) => (
                                <button
                                    key={idx}
                                    className="default-option-btn"
                                    disabled={isSaving}
                                    onClick={() => {
                                        setAreaName(option);
                                        setStep(2);
                                    }}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>

                        <div className="custom-input-wrapper">
                            <input
                                autoFocus
                                type="text"
                                className="custom-input-field"
                                placeholder="Or write your own thing..."
                                value={areaName}
                                onChange={(e) => setAreaName(e.target.value)}
                                onKeyDown={handleStep1KeyDown}
                                disabled={isSaving}
                            />
                        </div>

                        <div className="create-area-footer">
                            {areaName.trim() && (
                                <button 
                                    className="submit-btn" 
                                    onClick={handleStep1Submit}
                                    disabled={isSaving}
                                >
                                    Next Level
                                </button>
                            )}
                            <button 
                                className="safe-exit-btn" 
                                onClick={handleSafeExit}
                                disabled={isSaving}
                            >
                                Assign to Future Self
                            </button>
                        </div>
                    </>
                ) : step === 2 ? (
                    /* STEP 2: SKILL */
                    <>
                        <div className="create-area-header">
                            <h1 className="prompt-title">
                                What skill or project will help you to become {areaName}?
                            </h1>
                            <span className="sub-header-label">Select an action below to start your skill</span>
                        </div>

                        {/* Quick-Start Verbs */}
                        <div className="verbs-row">
                            {quickStartVerbs.map((verb, idx) => (
                                <button
                                    key={idx}
                                    className="verb-pill-btn"
                                    onClick={() => handleVerbClick(verb)}
                                    disabled={isSaving}
                                >
                                    {verb}...
                                </button>
                            ))}
                        </div>

                        {/* Skill Name Input with Dynamic Helper Text */}
                        <div className="custom-input-wrapper">
                            {selectedVerb ? (
                                <div className="custom-input-line-wrapper">
                                    <span className="bold-prefix-verb">{selectedVerb}</span>
                                    <input
                                        ref={skillInputRef}
                                        autoFocus
                                        type="text"
                                        className="custom-input-field-rest"
                                        placeholder={
                                            selectedVerb === 'Building' ? 'my SaaS, a workout routine, an email funnel...' :
                                            selectedVerb === 'Practicing' ? 'Spanish, coding, public speaking...' :
                                            selectedVerb === 'Maintaining' ? 'inbox zero, my diet, household chores...' :
                                            'AI tools, new marketing channels, 3D printing...'
                                        }
                                        value={skillRestName}
                                        onChange={(e) => setSkillRestName(e.target.value)}
                                        onKeyDown={handleStep2KeyDown}
                                        disabled={isSaving}
                                    />
                                </div>
                            ) : (
                                <input
                                    ref={skillInputRef}
                                    autoFocus
                                    type="text"
                                    className="custom-input-field"
                                    placeholder="e.g. Practicing Spanish, Building a startup..."
                                    value={skillName}
                                    onChange={(e) => setSkillName(e.target.value)}
                                    onKeyDown={handleStep2KeyDown}
                                    disabled={isSaving}
                                />
                            )}
                        </div>

                        {/* Priority Dimmer Switch - Shown only when skill name content exists */}
                        {(selectedVerb ? skillRestName.trim() : skillName.trim()) && (
                            <div className="priority-switch-container">
                                <span className="priority-label">What is the priority level for this right now?</span>
                                <div className="priority-switch-row">
                                    {priorities.map((p) => {
                                        const isSelected = priority === p;
                                        return (
                                            <button
                                                key={p}
                                                type="button"
                                                className={`priority-switch-btn ${isSelected ? 'active' : ''}`}
                                                onClick={() => setPriority(p)}
                                                disabled={isSaving}
                                            >
                                                {p}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="create-area-footer">
                            {(selectedVerb ? skillRestName.trim() : skillName.trim()) && (
                                <button 
                                    className="submit-btn" 
                                    onClick={handleStep2Submit}
                                    disabled={isSaving}
                                >
                                    Next Level
                                </button>
                            )}
                            <button 
                                className="safe-exit-btn" 
                                onClick={handleSafeExit}
                                disabled={isSaving}
                            >
                                Assign to Future Self
                            </button>
                        </div>
                    </>
                ) : step === 3 ? (
                    /* STEP 3: EXPERIMENT */
                    <>
                        <div className="create-area-header">
                            <h1 className="prompt-title text-center">
                                Let’s run an experiment for {selectedVerb ? `${selectedVerb} ${skillRestName}` : skillName}.
                            </h1>
                            <span className="sub-header-label-explanation">
                                Regular goals don’t compute on brains like ours, experiments are more like “how much can I achieve in x amount of time? or “how does it feel to commit to this?” There is no achieved or failed, its just data gathering
                            </span>
                        </div>

                        <div className="custom-input-wrapper">
                            <span className="step3-field-label">What exactly are you testing out?</span>
                            <input
                                autoFocus
                                type="text"
                                className="custom-input-field"
                                placeholder='e.g., "Preparing everything for beta testers"'
                                value={experimentName}
                                onChange={(e) => setExperimentName(e.target.value)}
                                onKeyDown={handleStep3KeyDown}
                                disabled={isSaving}
                            />
                        </div>

                        {experimentName.trim() && (
                            <div className="deadline-switch-container">
                                <span className="deadline-question-label">Do you have a strict, EXTERNAL (not self imposed) deadline for this? like a client, an event or something? If not, select "ongoing"</span>
                                <div className="deadline-pills-row">
                                    <button
                                        type="button"
                                        className={`deadline-pill-btn ${hasDeadline === 'no' ? 'active' : ''}`}
                                        onClick={() => {
                                            setHasDeadline('no');
                                            handleStep3Submit(null);
                                        }}
                                        disabled={isSaving}
                                    >
                                        Ongoing
                                    </button>
                                    <button
                                        type="button"
                                        className={`deadline-pill-btn ${hasDeadline === 'yes' ? 'active' : ''}`}
                                        onClick={() => setHasDeadline('yes')}
                                        disabled={isSaving}
                                    >
                                        Yes, I have an external deadline
                                    </button>
                                </div>

                                {hasDeadline === 'yes' && (
                                    <div className="date-picker-wrapper">
                                        <input
                                            type="date"
                                            className="native-date-picker"
                                            value={deadlineDate}
                                            onChange={(e) => setDeadlineDate(e.target.value)}
                                            disabled={isSaving}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="create-area-footer">
                            {experimentName.trim() && hasDeadline === 'yes' && deadlineDate && (
                                <button 
                                    className="submit-btn" 
                                    onClick={() => handleStep3Submit(deadlineDate)}
                                    disabled={isSaving}
                                >
                                    Next Level
                                </button>
                            )}
                            <button 
                                className="safe-exit-btn" 
                                onClick={handleSafeExit}
                                disabled={isSaving}
                            >
                                Assign to Future Self
                            </button>
                        </div>
                    </>
                ) : step === 4 ? (
                    /* STEP 4: ASPECT */
                    aspectStep === 'dump' ? (
                        /* STEP 4a: ASPECT BRAIN DUMP */
                        <>
                            <div className="create-area-header">
                                <h1 className="prompt-title text-center">
                                    What moving pieces (Aspects) make up {experimentName}?
                                </h1>
                                <span className="sub-header-label-explanation">
                                    Don't worry about organizing them yet. Just brain-dump everything you can think of so you don't have to hold it in your head. (separate aspects with a comma or enter)
                                </span>
                            </div>

                            <div className="custom-input-wrapper">
                                <textarea
                                    autoFocus
                                    className="custom-textarea-field"
                                    placeholder='e.g., "For learning Russian: Vocabulary, Listening, Speaking with a tutor..."'
                                    value={aspectDumpText}
                                    onChange={(e) => setAspectDumpText(e.target.value)}
                                    disabled={isSaving}
                                />
                            </div>

                            <div className="create-area-footer">
                                {aspectDumpText.trim() && (
                                    <button 
                                        className="submit-btn" 
                                        onClick={() => {
                                            const parsed = aspectDumpText.split(/,|\n/).map(s => s.trim()).filter(Boolean);
                                            if (parsed.length > 0) {
                                                setAspectNames(parsed);
                                                setAspectStep('select');
                                            }
                                        }}
                                        disabled={isSaving}
                                    >
                                        Next Level
                                    </button>
                                )}
                                <button 
                                    className="safe-exit-btn" 
                                    onClick={handleSafeExit}
                                    disabled={isSaving}
                                >
                                    Assign to Future Self
                                </button>
                            </div>
                        </>
                    ) : (
                        /* STEP 4b: ASPECT FOCUS SELECTION */
                        <>
                            <div className="create-area-header">
                                <h1 className="prompt-title text-center">
                                    Great. Which ONE of these should we break down into tasks first?
                                </h1>
                            </div>

                            <div className="aspect-options-grid">
                                {Array.from(new Set([...aspectNames, ...existingAspects])).map((option, idx) => (
                                    <button
                                        key={idx}
                                        className="default-option-btn aspect-select-btn"
                                        disabled={isSaving}
                                        onClick={() => {
                                            setSelectedAspect(option);
                                            setStep(5);
                                        }}
                                    >
                                        {option}
                                    </button>
                                ))}
                            </div>

                            <div className="create-area-footer">
                                <button 
                                    className="safe-exit-btn" 
                                    onClick={handleSafeExit}
                                    disabled={isSaving}
                                >
                                    Assign to Future Self
                                </button>
                            </div>
                        </>
                    )
                ) : (
                    /* STEP 5: TASK */
                    <>
                        <div className="create-area-header">
                            <h1 className="prompt-title text-center">
                                Now you’ll brain dump a few tasks for {selectedAspect}.
                            </h1>
                            <span className="sub-header-label-explanation">
                                Don't worry about the other aspects rn, you’ll add them later, for now just focus on the one-time-tasks that come to mind in relation to this aspect, later you’ll discover “activities”
                            </span>
                        </div>

                        <div className="custom-input-wrapper">
                            <textarea
                                autoFocus
                                className="custom-textarea-field"
                                placeholder='e.g., "Draft the first paragraph, buy the domain name, find a YouTube tutorial..."'
                                value={taskDumpText}
                                onChange={(e) => setTaskDumpText(e.target.value)}
                                disabled={isSaving}
                            />
                        </div>

                        <div className="create-area-footer">
                            {showButtons && (
                                <>
                                    <div className="bimodal-finish-row">
                                        <button
                                            className="submit-btn bimodal-btn"
                                            onClick={() => {
                                                handleFinalSave({
                                                    taskNamesToSave: parsedTasks,
                                                    redirectTo: '/focus'
                                                });
                                            }}
                                            disabled={isSaving}
                                        >
                                            Wanna start executing
                                        </button>
                                        <button
                                            className="submit-btn bimodal-btn secondary"
                                            onClick={() => setShowKeepDumpingPrompt(true)}
                                            disabled={isSaving}
                                        >
                                            Keep Brain-Dumping.
                                        </button>
                                    </div>

                                    {showKeepDumpingPrompt && (
                                        <div className="keep-dumping-prompt-container">
                                            <span className="keep-dumping-label">What-you wanna keep dumping?</span>
                                            <div className="keep-dumping-actions">
                                                <button
                                                    className="verb-pill-btn keep-dumping-btn"
                                                    onClick={() => {
                                                        handleFinalSave({
                                                            taskNamesToSave: parsedTasks,
                                                            loopToStep: 4
                                                        });
                                                    }}
                                                    disabled={isSaving}
                                                >
                                                    Another Aspect
                                                </button>
                                                <button
                                                    className="verb-pill-btn keep-dumping-btn"
                                                    onClick={() => {
                                                        handleFinalSave({
                                                            taskNamesToSave: parsedTasks,
                                                            loopToStep: 2
                                                        });
                                                    }}
                                                    disabled={isSaving}
                                                >
                                                    A New Skill
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            <button 
                                className="safe-exit-btn" 
                                onClick={handleSafeExit}
                                disabled={isSaving}
                            >
                                Assign to Future Self
                            </button>
                        </div>
                    </>
                )}

            </div>
        </div>
    );
};

export default CreateLifeAreaPage;
