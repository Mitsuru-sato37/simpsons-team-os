import json
import tempfile
import unittest
from pathlib import Path

from video_analysis.detector import Feature, detect_candidates, format_time, parse_time
from video_analysis.storage import load_analysis, save_analysis, save_feedback
from video_analysis.extract import iter_jpegs
from video_analysis.pipeline import refine_candidates
from video_analysis.detector import Candidate
from io import BytesIO


class DetectorTests(unittest.TestCase):
    def test_persistent_change_produces_one_candidate(self):
        frames = []
        for second in range(0, 250, 10):
            before = second < 120
            frames.append(Feature(second, 0.35 if before else 0.13,
                                  0.001 if before else 0.018,
                                  0.13 if before else 0.05,
                                  4.0 if second != 120 else 20.0))
        result = detect_candidates(frames, interval=10, limit=8)
        self.assertEqual(len(result), 1)
        self.assertLessEqual(abs(result[0].second - 120), 10)
        self.assertGreater(result[0].score, 50)

    def test_single_color_flash_is_ignored(self):
        frames = [Feature(second, 0.3, 0.02 if second == 100 else 0.001,
                          0.1, 4.0) for second in range(0, 250, 10)]
        self.assertEqual(detect_candidates(frames, interval=10), [])

    def test_camera_motion_alone_is_ignored(self):
        frames = [Feature(second, 0.3, 0.001, 0.1,
                          80.0 if second == 100 else 4.0)
                  for second in range(0, 250, 10)]
        self.assertEqual(detect_candidates(frames, interval=10), [])

    def test_small_persistent_uniform_shift_is_detected(self):
        frames = [Feature(second, 0.027 if second < 120 else 0.024,
                          0.0002 if second < 120 else 0.0022,
                          0.243 if second < 120 else 0.218, 3.0)
                  for second in range(0, 250, 10)]
        result = detect_candidates(frames, interval=10)
        self.assertEqual(len(result), 1)
        self.assertLessEqual(abs(result[0].second - 120), 10)

    def test_time_round_trip(self):
        self.assertEqual(parse_time('1:02:03'), 3723)
        self.assertEqual(format_time(3723), '1:02:03')
        self.assertEqual(parse_time('34:47'), 2087)
        self.assertEqual(parse_time('65:00'), 3900)
        with self.assertRaises(ValueError):
            parse_time('35:99')


class StorageTests(unittest.TestCase):
    def test_feedback_keeps_analysis_metadata_and_corrected_time(self):
        with tempfile.TemporaryDirectory() as directory:
            video = Path(directory) / 'game.mp4'
            video.write_bytes(b'video')
            output = Path(directory) / 'results'
            record = save_analysis(output, video, 120, {'interval': 10},
                                   [{'second': 60, 'score': 76}], '1.0')
            save_feedback(record, 0, 'incorrect', 67, 'bench shot')
            saved = json.loads(record.read_text(encoding='utf-8'))
            self.assertEqual(saved['video']['path'], str(video.resolve()))
            self.assertEqual(saved['config']['interval'], 10)
            self.assertEqual(saved['logic_version'], '1.0')
            self.assertEqual(saved['candidates'][0]['feedback']['correct_second'], 67)
            self.assertEqual(saved['candidates'][0]['feedback']['comment'], 'bench shot')
            self.assertEqual(load_analysis(record)['candidates'][0]['feedback']['verdict'],
                             'incorrect')
            save_feedback(record, 0, 'correct', 67, 'reviewed again')
            reread = load_analysis(record)['candidates'][0]
            self.assertEqual(len(reread['feedback_history']), 2)
            self.assertEqual(reread['feedback_history'][0]['comment'], 'bench shot')

    def test_analysis_never_replaces_existing_result(self):
        with tempfile.TemporaryDirectory() as directory:
            video = Path(directory) / 'game.mp4'
            video.write_bytes(b'video')
            output = Path(directory) / 'results'
            first = save_analysis(output, video, 120, {}, [], '1.0')
            second = save_analysis(output, video, 120, {}, [], '1.0')
            self.assertNotEqual(first, second)
            self.assertTrue(first.exists())

    def test_feedback_rejects_time_outside_video(self):
        with tempfile.TemporaryDirectory() as directory:
            video = Path(directory) / 'game.mp4'
            video.write_bytes(b'video')
            record = save_analysis(Path(directory) / 'results', video, 120,
                                   {}, [{'second': 60, 'score': 70}], '1.0')
            with self.assertRaises(ValueError):
                save_feedback(record, 0, 'incorrect', 121)


class PipelineTests(unittest.TestCase):
    def test_jpeg_stream_reader_handles_chunk_boundaries(self):
        stream = BytesIO(b'noise\xff\xd8one\xff\xd9\xff\xd8two\xff\xd9')
        self.assertEqual(list(iter_jpegs(stream, chunk_size=3)),
                         [b'\xff\xd8one\xff\xd9', b'\xff\xd8two\xff\xd9'])

    def test_refinement_uses_detail_transition(self):
        coarse = [Candidate(120, 70, {})]
        def extract(start, duration, interval):
            return [Feature(second, 0.027 if second < 127 else 0.024,
                            0.0002 if second < 127 else 0.0022,
                            0.243 if second < 127 else 0.218, 3.0)
                    for second in range(int(start), int(start + duration))]
        result = refine_candidates(coarse, extract, duration=250)
        self.assertLessEqual(abs(result[0].second - 127), 2)

    def test_sustained_low_motion_adds_only_supporting_evidence(self):
        coarse = [Candidate(120, 70, {})]
        def extract(start, duration, interval):
            return [Feature(second, 0.027 if second < 127 else 0.024,
                            0.0002 if second < 127 else 0.0022,
                            0.243 if second < 127 else 0.218,
                            1.0 if 121 <= second <= 127 else 5.0)
                    for second in range(int(start), int(start + duration))]
        result = refine_candidates(coarse, extract, duration=250)
        self.assertGreaterEqual(result[0].evidence['low_motion_seconds'], 5)


if __name__ == '__main__':
    unittest.main()
