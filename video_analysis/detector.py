"""Persistent visual-state change detection; scores are heuristic, not probabilities."""

from dataclasses import dataclass
from statistics import median


LOGIC_VERSION = '1.2'


@dataclass(frozen=True)
class Feature:
    second: float
    green: float
    purple: float
    yellow: float
    diff: float
    regions: tuple = ()


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


_REGION_SCALES = (0.004, 0.0015, 0.025)
_MIN_SPATIAL_DISTANCE = 8.0
_MAX_SPATIAL_DISTANCE = 22.0
_MIN_TRANSITION_SPAN_SECONDS = 80
_MAX_TRANSITION_SPAN_SECONDS = 240
_MIN_NORMALIZED_PATH_RATIO = 6.5
_MIN_ACTIVITY_RATIO = 0.9
_MIN_HOME_PLATE_CHANGE_SHARE = 0.30


def _regional_state(frames):
    available = [frame.regions for frame in frames if len(frame.regions) == 16]
    if not available:
        return None
    return tuple(tuple(median(sample[index][channel] for sample in available)
                       for channel in range(3))
                 for index in range(16))


def _spatial_distance(left, right):
    return sum(abs(right[index][channel] - left[index][channel]) / scale
               for index in range(16)
               for channel, scale in enumerate(_REGION_SCALES))


def _interval(candidate):
    return candidate.evidence.get('estimated_interval')


def _same_candidate_cluster(left, right, min_gap_seconds):
    if abs(left.second - right.second) < min_gap_seconds:
        return True
    left_interval = _interval(left)
    right_interval = _interval(right)
    if not left_interval or not right_interval:
        return False
    overlap = max(0, min(left_interval['end_second'], right_interval['end_second']) -
                  max(left_interval['start_second'], right_interval['start_second']))
    shorter = min(left_interval['end_second'] - left_interval['start_second'],
                  right_interval['end_second'] - right_interval['start_second'])
    return shorter > 0 and overlap / shorter >= 0.4


def _spatial_transition_candidates(frames, interval, window_seconds,
                                   min_gap_seconds, limit):
    before_count = max(3, round(window_seconds / interval))
    min_span = max(1, round(_MIN_TRANSITION_SPAN_SECONDS / interval))
    max_span = max(min_span, round(_MAX_TRANSITION_SPAN_SECONDS / interval))
    found = []
    for start_index in range(before_count,
                             len(frames) - before_count - min_span + 1):
        before = _regional_state(frames[start_index - before_count:start_index])
        if before is None:
            continue
        for span_count in range(min_span, min(max_span,
                                  len(frames) - start_index - before_count) + 1):
            end_index = start_index + span_count
            after = _regional_state(frames[end_index:end_index + before_count])
            if after is None:
                continue
            distance = _spatial_distance(before, after)
            if not (_MIN_SPATIAL_DISTANCE <= distance <= _MAX_SPATIAL_DISTANCE):
                continue
            home_plate_change = sum(
                abs(after[index][channel] - before[index][channel]) /
                _REGION_SCALES[channel]
                for index in range(16) if index % 4 == 3
                for channel in range(3))
            home_plate_share = home_plate_change / distance
            if home_plate_share < _MIN_HOME_PLATE_CHANGE_SHARE:
                continue
            span_regions = [_regional_state([frame])
                            for frame in frames[start_index:end_index + 1]]
            if any(state is None for state in span_regions):
                continue
            path_distance = sum(_spatial_distance(left, right)
                                for left, right in zip(span_regions,
                                                       span_regions[1:]))
            path_ratio = path_distance / distance * interval / 20
            if path_ratio < _MIN_NORMALIZED_PATH_RATIO:
                continue
            before_motion = median(frame.diff for frame in
                                   frames[start_index - before_count:start_index])
            inside_motion = median(frame.diff for frame in
                                   frames[start_index:end_index + 1])
            after_motion = median(frame.diff for frame in
                                  frames[end_index + 1:end_index + 1 + before_count])
            outside_motion = max(before_motion, after_motion)
            if inside_motion < outside_motion * _MIN_ACTIVITY_RATIO:
                continue
            changed_cells = sum(
                sum(abs(after[index][channel] - before[index][channel]) /
                    _REGION_SCALES[channel] for channel in range(3)) >= 0.5
                for index in range(16))
            if changed_cells < 3:
                continue
            start_second = frames[start_index].second
            end_second = frames[end_index].second
            span_seconds = end_second - start_second
            distance_fit = 1 - abs(distance - 14.25) / 12.5
            duration_fit = 1 - abs(span_seconds - 130) / 160
            score = round(50 + 50 * (0.7 * distance_fit + 0.3 * duration_fit))
            found.append(Candidate(
                (start_second + end_second) / 2,
                min(100, max(0, score)),
                {'coarse_second': (start_second + end_second) / 2,
                 'estimated_interval': {'start_second': round(start_second),
                                        'end_second': round(end_second)},
                 'detection_method': 'spatial_state',
                 'regional_distance': round(distance, 2),
                 'home_plate_change_share': round(home_plate_share, 2),
                 'spatial_path_ratio': round(path_ratio, 2),
                 'activity_ratio': round(inside_motion / outside_motion, 2)
                 if outside_motion else None,
                 'changed_regions': changed_cells},
            ))

    selected = []
    for candidate in sorted(found, key=lambda item: (-item.score, item.second)):
        if all(not _same_candidate_cluster(candidate, prior, min_gap_seconds)
               for prior in selected):
            selected.append(candidate)
        if len(selected) >= limit:
            break
    return selected


def detect_candidates(frames, interval=10, window_seconds=30, limit=12,
                      min_gap_seconds=90, min_score=38,
                      include_spatial=True):
    """Find persistent color changes and slower distributed field-state shifts.

    Single-frame motion never creates a candidate. The spatial route looks
    for moderate, distributed changes between stable states across an
    80–240-second transition span; abrupt local changes are excluded.
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
    if include_spatial:
        found.extend(_spatial_transition_candidates(
            frames, interval, window_seconds, min_gap_seconds, limit))
    # Keep the strongest point in each temporal or overlapping-span cluster.
    selected = []
    for candidate in sorted(found, key=lambda item: (-item.score, item.second)):
        if all(not _same_candidate_cluster(candidate, prior, min_gap_seconds)
               for prior in selected):
            selected.append(candidate)
        if len(selected) >= limit:
            break
    return sorted(selected, key=lambda item: item.second)
