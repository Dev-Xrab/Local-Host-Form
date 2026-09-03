export const STATUS_LABEL = {
  submitted: "Submitted",
  "in-progress": "In Progress",
  joined: "Joined",
};

export const QUIZ_STATUS_LABEL = {
  live: "Live",
  paused: "Paused",
  ended: "Ended",
};

export const QUIZ_STATUS_PILL = {
  live: "status-pill-in-progress",
  paused: "status-pill-joined",
  ended: "status-pill-submitted",
};

export const toSeconds = (time) => {
  const [minutes, seconds] = time.split(":").map(Number);
  return minutes * 60 + seconds;
};

export const toMinutesSinceMidnight = (time) => {
  const [clock, period] = time.split(" ");
  let [hours, minutes] = clock.split(":").map(Number);
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

export const sortParticipants = (participants, sortBy) =>
  [...participants].sort((a, b) => {
    if (sortBy === "score") {
      if (a.score == null && b.score == null) {
        return toMinutesSinceMidnight(a.joinedAt) - toMinutesSinceMidnight(b.joinedAt);
      }
      if (a.score == null) return 1;
      if (b.score == null) return -1;
      return b.score - a.score || toSeconds(a.timeTaken) - toSeconds(b.timeTaken);
    }
    return toMinutesSinceMidnight(a.joinedAt) - toMinutesSinceMidnight(b.joinedAt);
  });
