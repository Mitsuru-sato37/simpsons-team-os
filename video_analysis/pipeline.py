"""Two-stage candidate analysis of a local MP4."""

from pathlib import Path
from statistics import median

from .detector import LOGIC_VERSION, Candidate, detect_candidates
from .extract import probe_duration, require_tools, sample_features
from .storage import save_analysis


DEFAULT_CONFIG = {
    'coarse_interval_seconds': 10,
    'detail_interval_seconds': 1,
    'detail_radius_seconds': 45,
    'state_window_seconds': 30,
    'min_gap_seconds': 90,
    'min_score': 38,
    'max_candidates': 12,
}

_FEATURE_SCALES = {'green': 0.004, 'purple': 0.0015, 'yellow': 0.025}


def _state(frames):
    return {name: median(getattr(frame, name) for frame in frames)
            for name in _FEATURE_SCALES}


def _distance(left, right):
    return sum(abs(left[name] - right[name]) / scale
               for name, scale in _FEATURE_SCALES.items())


def estimate_transition_interval(frames, center, reference_gap=15,
                                 reference_window=15, settle_seconds=5):
    """Estimate when visual features leave the old state and settle into the new one.

    This is a color-state interval, not a semantic estimate of the last and
    first baseball plays. Return None when stable reference states are absent.
    """
    frames = sorted(frames, key=lambda frame: frame.second)
    before_end = center - reference_gap
    after_start = center + reference_gap
    before = [frame for frame in frames
              if before_end - reference_window <= frame.second < before_end]
    after = [frame for frame in frames
             if after_start <= frame.second < after_start + reference_window]
    if len(before) < max(5, reference_window // 2) or \
       len(after) < max(5, reference_window // 2):
        return None

    old_state = _state(before)
    new_state = _state(after)
    magnitude = _distance(old_state, new_state)
    if magnitude < 1.0:
        return None

    smoothed = []
    for index, frame in enumerate(frames):
        neighborhood = frames[max(0, index - 2):min(len(frames), index + 3)]
        smoothed.append((frame.second, _state(neighborhood)))

    departure_start = None
    departure_run = 0
    departure_run_start = None
    for index, (second, state) in enumerate(smoothed):
        if second < before_end:
            continue
        progress = _distance(old_state, state) / magnitude
        if progress >= 0.20:
            if departure_run == 0:
                departure_run_start = second
            if index and second - smoothed[index - 1][0] != 1:
                departure_run = 0
                departure_run_start = second
            departure_run += 1
            if departure_run >= 3:
                departure_start = departure_run_start
                break
        else:
            departure_run = 0
            departure_run_start = None

    if departure_start is None:
        return None

    settle_run = 0
    for index, (second, state) in enumerate(smoothed):
        if second < departure_start:
            continue
        settled = _distance(state, new_state) / magnitude <= 0.20
        if settled:
            if settle_run == 0 or (index and second - smoothed[index - 1][0] == 1):
                settle_run += 1
            else:
                settle_run = 1
            if settle_run >= settle_seconds:
                end_second = smoothed[index - settle_seconds + 1][0]
                return {'start_second': round(departure_start),
                        'end_second': round(end_second)}
        else:
            settle_run = 0
    return None


def refine_candidates(coarse, extract, duration, radius=45):
    refined = []
    for candidate in coarse:
        if candidate.evidence.get('detection_method') == 'spatial_state':
            refined.append(candidate)
            continue
        start = max(0, candidate.second - radius)
        end = min(duration, candidate.second + radius)
        detail = extract(start, end - start, 1)
        nearby = detect_candidates(detail, interval=1, window_seconds=15,
                                   min_gap_seconds=20, limit=8,
                                   min_score=38, include_spatial=False)
        nearby = [item for item in nearby
                  if abs(item.second - candidate.second) <= 20]
        if nearby:
            best = max(nearby, key=lambda item: item.score)
            local_pairs = [(left, right) for left, right in zip(detail, detail[1:])
                           if abs(right.second - best.second) <= 15]
            if local_pairs:
                left, right = max(local_pairs, key=lambda pair:
                    0.5 * min(abs(pair[1].purple - pair[0].purple) / 0.0015, 1) +
                    0.3 * min(abs(pair[1].green - pair[0].green) / 0.004, 1) +
                    0.2 * min(abs(pair[1].yellow - pair[0].yellow) / 0.025, 1))
                precise_second = right.second
            else:
                precise_second = best.second
            interval = estimate_transition_interval(detail, precise_second)
            low_motion = 0
            current_run = 0
            for frame in detail:
                if abs(frame.second - precise_second) <= 20 and frame.diff <= 2.5:
                    current_run += 1
                    low_motion = max(low_motion, current_run)
                else:
                    current_run = 0
            refined.append(Candidate(precise_second,
                                     min(100, round((candidate.score + best.score) / 2) +
                                         (5 if low_motion >= 5 else 0)),
                                     {'coarse_second': candidate.second,
                                      'coarse_score': candidate.score,
                                      'low_motion_seconds': low_motion,
                                      'estimated_interval': interval,
                                      'detail': best.evidence}))
        else:
            refined.append(Candidate(candidate.second, candidate.score,
                                     {'coarse_second': candidate.second,
                                      'detail_unresolved': True,
                                      'estimated_interval': estimate_transition_interval(
                                          detail, candidate.second),
                                      'coarse': candidate.evidence}))
    return sorted(refined, key=lambda item: item.second)


def analyze(video, output_dir=None, progress=None, config=None):
    video = Path(video).resolve()
    if not video.is_file() or video.suffix.lower() != '.mp4':
        raise ValueError('存在する MP4 ファイルを選択してください')
    require_tools()
    settings = {**DEFAULT_CONFIG, **(config or {})}
    duration = probe_duration(video)
    def coarse_progress(second):
        if progress:
            progress(f'粗解析: {int(second)}/{int(duration)} 秒')
    features = sample_features(video, 0, duration,
                               settings['coarse_interval_seconds'],
                               coarse_progress)
    if not features:
        raise RuntimeError('動画からフレームを取得できませんでした')
    coarse = detect_candidates(features,
                               interval=settings['coarse_interval_seconds'],
                               window_seconds=settings['state_window_seconds'],
                               min_gap_seconds=settings['min_gap_seconds'],
                               min_score=settings['min_score'],
                               limit=settings['max_candidates'])
    def extract(start, length, interval):
        if progress:
            progress(f'詳細解析: {int(start)}〜{int(start + length)} 秒')
        return sample_features(video, start, length, interval)
    refined = refine_candidates(coarse, extract, duration,
                                settings['detail_radius_seconds'])
    entries = [{'second': round(item.second), 'score': item.score,
                'evidence': item.evidence} for item in refined]
    destination = output_dir or Path(__file__).resolve().parents[1] / '.local' / 'video-analysis'
    path = save_analysis(destination, video, duration, settings, entries,
                         LOGIC_VERSION)
    return path, entries
