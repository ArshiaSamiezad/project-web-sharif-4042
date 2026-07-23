
export const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds < 0) return "00:00";
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    const paddedMinutes = String(minutes).padStart(2, '0');
    const paddedSeconds = String(remainingSeconds).padStart(2, '0');
    
    return `${paddedMinutes}:${paddedSeconds}`;
  };