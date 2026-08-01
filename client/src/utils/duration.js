function normalizeSeconds(value) {
  const seconds = Number(value);

  if (!Number.isFinite(seconds) || seconds < 0) {
    return 0;
  }

  return Math.floor(seconds);
}

function padNumber(value) {
  return String(value).padStart(2, "0");
}

export function formatVideoDuration(value) {
  const totalSeconds = normalizeSeconds(value);

  const hours = Math.floor(totalSeconds / 3600);

  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return [hours, padNumber(minutes), padNumber(seconds)].join(":");
  }

  return [minutes, padNumber(seconds)].join(":");
}

export function formatContentDuration(value) {
  const totalSeconds = normalizeSeconds(value);

  if (totalSeconds === 0) {
    return "0m";
  }

  if (totalSeconds < 60) {
    return "<1m";
  }

  const hours = Math.floor(totalSeconds / 3600);

  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours === 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

export function clampPercentage(value) {
  const percentage = Number(value);

  if (!Number.isFinite(percentage)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(percentage)));
}
