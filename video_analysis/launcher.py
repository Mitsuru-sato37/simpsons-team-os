"""Show useful diagnostics when the no-console Windows launcher fails."""

import ctypes
import traceback
from pathlib import Path


def show_startup_error(error_text):
    log_path = Path(__file__).resolve().parent.parent / '.local' / 'video-analysis' / 'startup-error.log'
    try:
        log_path.parent.mkdir(parents=True, exist_ok=True)
        log_path.write_text(error_text, encoding='utf-8')
        message = f"アプリを起動できませんでした。\n\n詳しい内容: {log_path}"
    except OSError:
        message = f"アプリを起動できませんでした。\n\n{error_text[-1500:]}"
    ctypes.windll.user32.MessageBoxW(0, message, 'Simpsons Inning Checker', 0x10)


def main():
    try:
        from .app import main as run_app
        run_app()
    except Exception:
        show_startup_error(traceback.format_exc())


if __name__ == '__main__':
    main()
