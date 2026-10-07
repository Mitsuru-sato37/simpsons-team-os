"""Local JSON analysis and feedback records."""

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4


def _write(path, record):
    temporary = path.with_name(path.name + '.tmp')
    try:
        temporary.write_text(json.dumps(record, ensure_ascii=False, indent=2),
                             encoding='utf-8')
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def save_analysis(directory, video, duration, config, candidates, logic_version):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    video = Path(video).resolve()
    if not video.is_file():
        raise FileNotFoundError(video)
    record = {
        'schema_version': 1,
        'analysis_at': datetime.now(timezone.utc).isoformat(),
        'logic_version': logic_version,
        'video': {'path': str(video), 'size_bytes': video.stat().st_size,
                  'duration_seconds': duration},
        'config': config,
        'candidates': [{**item, 'feedback': None, 'feedback_history': []}
                       for item in candidates],
    }
    path = directory / f'{video.stem}-{uuid4().hex[:12]}.json'
    _write(path, record)
    return path


def load_analysis(path):
    record = json.loads(Path(path).read_text(encoding='utf-8'))
    if record.get('schema_version') != 1 or not isinstance(record.get('candidates'), list):
        raise ValueError('対応していない解析結果です')
    return record


def save_feedback(path, candidate_index, verdict, correct_second=None, comment=''):
    if verdict not in ('correct', 'incorrect'):
        raise ValueError('判定は correct または incorrect を指定してください')
    if correct_second is not None and correct_second < 0:
        raise ValueError('正しい時刻は 0 秒以上です')
    path = Path(path)
    record = load_analysis(path)
    if correct_second is not None and correct_second > record['video']['duration_seconds']:
        raise ValueError('正しい時刻が動画の長さを超えています')
    feedback = {
        'verdict': verdict,
        'correct_second': correct_second,
        'comment': comment.strip(),
        'recorded_at': datetime.now(timezone.utc).isoformat(),
    }
    candidate = record['candidates'][candidate_index]
    candidate.setdefault('feedback_history', []).append(feedback)
    candidate['feedback'] = feedback
    _write(path, record)
