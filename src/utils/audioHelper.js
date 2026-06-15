// Pre-initialize and preload the audio elements in memory for zero-latency playback
const sounds = [
    '/Task%20completion%201.mp3',
    '/Task%20completion%202.mp3',
    '/Task%20completion%203.mp3'
].map(src => {
    try {
        const audio = new Audio(src);
        audio.preload = 'auto';
        return audio;
    } catch (e) {
        console.warn('Failed to pre-initialize audio for:', src, e);
        return null;
    }
});

let experimentSound = null;
try {
    experimentSound = new Audio('/Chime%20for%20objective%20or%20experiments.mp3');
    experimentSound.preload = 'auto';
} catch (e) {
    console.warn('Failed to pre-initialize experiment audio:', e);
}

export const playCompletionSound = (volume = 0.4) => {
    try {
        // Respect settings toggle for completion sounds (defaults to true)
        const soundsEnabled = localStorage.getItem('completion_sounds_enabled') !== 'false';
        if (!soundsEnabled) return;

        let index = parseInt(localStorage.getItem('completion_sound_index') || '0', 10);
        
        const audio = sounds[index];
        if (audio) {
            audio.currentTime = 0; // Rewind to start if already played
            audio.volume = volume;
            audio.play().catch(err => console.warn('Audio play interrupted or blocked:', err));
        }
        
        // Rotate to the next sound index
        const nextIndex = (index + 1) % sounds.length;
        localStorage.setItem('completion_sound_index', nextIndex.toString());
    } catch (err) {
        console.warn('Audio play failed:', err);
    }
};

export const playExperimentCompletionSound = (volume = 0.4) => {
    try {
        // Respect settings toggle for experiment/objective sounds (defaults to true)
        const soundsEnabled = localStorage.getItem('experiment_sounds_enabled') !== 'false';
        if (!soundsEnabled) return;

        if (experimentSound) {
            experimentSound.currentTime = 0;
            experimentSound.volume = volume;
            experimentSound.play().catch(err => console.warn('Audio play interrupted or blocked:', err));
        }
    } catch (err) {
        console.warn('Audio play failed:', err);
    }
};
