"""Persistent visual-state change detection; scores are heuristic, not probabilities."""

from dataclasses import dataclass
from statistics import median


LOGIC_VERSION = '1.0'


@dataclass(frozen=True)
class Feature:
    second: float
    green: float
    purple: float
    yellow: float
    diff: float


@dataclass(frozen=True)
class Candidate:
    second: float
    score: int
    evidence: dict


def format_time(value):
    second = int(round(value))
    hour, remainder = divmod(second, 3600)
    minute, second = divmod(remainder, 60)
    return f'{hour}:{minute:02d}:{second:02d}' if hour else f'{minute:02d}:{second:02d}'


def parse_time(value):
    parts = value.strip().split(':')
    if len(parts) not in (2, 3) or any(not part.isdigit() for part in parts):
        raise ValueError('時刻は MM:SS または H:MM:SS で入力してください')
    numbers = list(map(int, parts))
    if numbers[-1] >= 60 or (len(numbers) == 3 and numbers[-2] >= 60):
        raise ValueError('分・秒は 0〜59 で入力してください')
    if len(numbers) == 2:
        return numbers[0] * 60 + numbers[1]
    return numbers[0] * 3600 + numbers[1] * 60 + numbers[2]


def _state(frames):
    return {name: median(getattr(frame, name) for frame in frames)
            for name in ('green', 'purple', 'yellow')}


def detect_candidates(frames, interval=10, window_seconds=30, limit=12,
                      min_gap_seconds=90, min_score=38):
    """Find persistent transitions with color agreement across both sides.

    A solitary frame difference never contributes to the score. Multiple
    features must change across stable before/after windows.
    """
    frames = sorted(frames, key=lambda frame: frame.second)
    count = max(3, round(window_seconds / interval))
    if len(frames) < count * 2:
        return []
    found = []
    for index in range(count, len(frames) - count + 1):
        before = _state(frames[index - count:index])
        after = _state(frames[index:index + count])
        change = {key: abs(after[key] - before[key]) for key in before}
        strengths = {
            'purple': min(change['purple'] / 0.0015, 1),
            'green': min(change['green'] / 0.004, 1),
            'yellow': min(change['yellow'] / 0.025, 1),
        }
        # Green/yellow background alone is weak; a visible uniform or a
        # substantial field-layout shift must accompany another change.
        if strengths['purple'] < 0.15 and strengths['green'] < 0.45:
            continue
        if sum(value >= 0.18 for value in strengths.values()) < 2:
            continue
        score = round(100 * (0.50 * strengths['purple'] +
                             0.30 * strengths['green'] +
                             0.20 * strengths['yellow']))
        if score >= min_score:
            found.append(Candidate(frames[index].second, score, {
                'before': before, 'after': after, 'change': change,
            }))
    # Keep the strongest point in each cluster, then present in time order.
    selected = []
    for candidate in sorted(found, key=lambda item: (-item.score, item.second)):
        if all(abs(candidate.second - prior.second) >= min_gap_seconds
               for prior in selected):
            selected.append(candidate)
        if len(selected) >= limit:
            break
    return sorted(selected, key=lambda item: item.second)
