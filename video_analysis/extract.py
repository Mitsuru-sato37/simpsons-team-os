"""Sample local video frames with FFmpeg without writing or uploading the video."""

import json
import shutil
import subprocess

from .detector import Feature


def iter_jpegs(stream, chunk_size=65536):
    buffer = bytearray()
    while True:
        chunk = stream.read(chunk_size)
        if not chunk:
            break
        buffer.extend(chunk)
        while True:
            start = buffer.find(b'\xff\xd8')
            if start < 0:
                buffer[:] = buffer[-1:]
                break
            if start:
                del buffer[:start]
            end = buffer.find(b'\xff\xd9', 2)
            if end < 0:
                break
            end += 2
            yield bytes(buffer[:end])
            del buffer[:end]


def require_tools():
    missing = [name for name in ('ffmpeg', 'ffprobe') if not shutil.which(name)]
    if missing:
        raise RuntimeError(f"見つからない実行ファイル: {', '.join(missing)}。PATHに追加してください")
    try:
        import cv2
        import numpy
    except ImportError as error:
        raise RuntimeError('OpenCV と NumPy を使用できる Python で起動してください') from error
    return cv2, numpy


def probe_duration(video):
    process = subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
         '-of', 'json', str(video)], capture_output=True, text=True, check=True)
    duration = float(json.loads(process.stdout)['format']['duration'])
    if duration <= 0:
        raise ValueError('動画の長さを取得できません')
    return duration


def sample_features(video, start, duration, interval, progress=None):
    cv2, np = require_tools()
    command = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-nostdin',
               '-ss', str(start), '-t', str(duration), '-i', str(video),
               '-vf', f'fps=1/{interval},scale=640:-2', '-q:v', '5',
               '-f', 'image2pipe', '-vcodec', 'mjpeg', 'pipe:1']
    process = subprocess.Popen(command, stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE)
    frames = []
    previous_gray = None
    try:
        for index, data in enumerate(iter_jpegs(process.stdout)):
            image = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
            if image is None:
                continue
            hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            total = image.shape[0] * image.shape[1]
            def ratio(lower, upper):
                return float(cv2.countNonZero(cv2.inRange(hsv, lower, upper)) / total)
            diff = (float(cv2.absdiff(gray, previous_gray).mean())
                    if previous_gray is not None else 0.0)
            frames.append(Feature(start + index * interval,
                                  ratio((35, 40, 40), (90, 255, 255)),
                                  ratio((120, 40, 40), (165, 255, 255)),
                                  ratio((15, 40, 40), (40, 255, 255)), diff))
            previous_gray = gray
            if progress and index % 10 == 0:
                progress(min(start + index * interval, start + duration))
        stderr = process.stderr.read().decode('utf-8', errors='replace')
        if process.wait() != 0:
            raise RuntimeError(f'FFmpeg の解析に失敗しました: {stderr.strip()}')
    finally:
        if process.poll() is None:
            process.kill()
            process.wait()
        process.stdout.close()
        process.stderr.close()
    return frames
