"""Small local desktop interface for inning-change review and feedback."""

import queue
import threading
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

from .detector import format_time, parse_time
from .pipeline import analyze
from .storage import load_analysis, save_feedback


class VideoAnalysisApp:
    def __init__(self, root):
        self.root = root
        self.root.title('Simpsons 動画解析')
        self.root.geometry('760x560')
        self.events = queue.Queue()
        self.record_path = None
        self.candidates = []
        self.video = tk.StringVar()
        self.status = tk.StringVar(value='MP4動画を選択してください')
        self.correct_time = tk.StringVar()
        self.comment = tk.StringVar()

        frame = ttk.Frame(root, padding=16)
        frame.pack(fill='both', expand=True)
        ttk.Label(frame, text='イニング切り替わり候補',
                  font=('', 16, 'bold')).pack(anchor='w')
        ttk.Label(frame, text='動画はこのPC内で解析します。候補のスコアは推定確率ではありません。',
                  wraplength=700).pack(anchor='w', pady=(4, 12))
        picker = ttk.Frame(frame)
        picker.pack(fill='x')
        ttk.Entry(picker, textvariable=self.video).pack(side='left', fill='x', expand=True)
        ttk.Button(picker, text='動画を選択', command=self.pick_video).pack(side='left', padx=(8, 0))
        self.analyze_button = ttk.Button(frame, text='解析する', command=self.start_analysis)
        self.analyze_button.pack(anchor='w', pady=12)
        ttk.Button(frame, text='保存済み結果を開く',
                   command=self.open_result).pack(anchor='w', pady=(0, 8))
        ttk.Label(frame, textvariable=self.status, wraplength=700).pack(anchor='w')
        self.listbox = tk.Listbox(frame, height=12, font=('Consolas', 11))
        self.listbox.pack(fill='both', expand=True, pady=12)
        self.listbox.bind('<<ListboxSelect>>', self.select_candidate)

        feedback = ttk.LabelFrame(frame, text='選択した候補へのフィードバック', padding=10)
        feedback.pack(fill='x')
        row = ttk.Frame(feedback)
        row.pack(fill='x')
        ttk.Label(row, text='正しい時刻（任意）').pack(side='left')
        ttk.Entry(row, textvariable=self.correct_time, width=12).pack(side='left', padx=8)
        ttk.Label(row, text='MM:SS / H:MM:SS').pack(side='left')
        ttk.Label(feedback, text='理由・コメント').pack(anchor='w', pady=(8, 0))
        ttk.Entry(feedback, textvariable=self.comment).pack(fill='x')
        actions = ttk.Frame(feedback)
        actions.pack(anchor='w', pady=(10, 0))
        ttk.Button(actions, text='正解として保存',
                   command=lambda: self.submit_feedback('correct')).pack(side='left')
        ttk.Button(actions, text='不正解として保存',
                   command=lambda: self.submit_feedback('incorrect')).pack(side='left', padx=8)
        self.root.after(100, self.process_events)

    def pick_video(self):
        path = filedialog.askopenfilename(title='試合動画を選択',
                                          filetypes=[('MP4動画', '*.mp4')])
        if path:
            self.video.set(path)

    def start_analysis(self):
        path = self.video.get().strip().strip('"')
        if not path:
            messagebox.showerror('動画を選択', 'MP4動画を選択してください')
            return
        self.analyze_button.state(['disabled'])
        self.listbox.delete(0, tk.END)
        self.candidates = []
        self.record_path = None
        self.status.set('解析を開始しています…')
        threading.Thread(target=self._run_analysis, args=(path,), daemon=True).start()

    def _run_analysis(self, path):
        try:
            record, candidates = analyze(path,
                progress=lambda message: self.events.put(('progress', message)))
            self.events.put(('done', (record, candidates)))
        except Exception as error:
            self.events.put(('error', str(error)))

    def process_events(self):
        try:
            while True:
                kind, value = self.events.get_nowait()
                if kind == 'progress':
                    self.status.set(value)
                elif kind == 'done':
                    self.record_path, self.candidates = value
                    self.show_candidates()
                    self.status.set(f'{len(self.candidates)}件の候補を保存しました。候補を選んで確認してください。'
                                    if self.candidates else '候補は見つかりませんでした。設定の見直しが必要な場合があります。')
                    self.analyze_button.state(['!disabled'])
                elif kind == 'error':
                    self.analyze_button.state(['!disabled'])
                    self.status.set('解析に失敗しました')
                    messagebox.showerror('解析エラー', value)
        except queue.Empty:
            pass
        self.root.after(100, self.process_events)

    def show_candidates(self):
        self.listbox.delete(0, tk.END)
        for item in self.candidates:
            label = f"{format_time(item['second']):>8}   スコア {item['score']:>3}/100"
            if item.get('evidence', {}).get('detail_unresolved'):
                label += '   詳細時刻は未確定'
            feedback = item.get('feedback')
            if feedback:
                label += '   正解' if feedback['verdict'] == 'correct' else '   不正解'
            self.listbox.insert(tk.END, label)

    def open_result(self):
        path = filedialog.askopenfilename(title='保存済み解析結果を開く',
                                          filetypes=[('解析結果 JSON', '*.json')])
        if not path:
            return
        try:
            record = load_analysis(path)
            self.record_path = path
            self.candidates = record['candidates']
            self.video.set(record['video']['path'])
            self.show_candidates()
            self.status.set(f'{len(self.candidates)}件の保存済み候補を開きました')
        except (ValueError, KeyError, OSError) as error:
            messagebox.showerror('読み込みエラー', str(error))

    def select_candidate(self, _event):
        selected = self.listbox.curselection()
        if selected:
            self.correct_time.set('')
            self.comment.set('')

    def submit_feedback(self, verdict):
        selected = self.listbox.curselection()
        if not selected or not self.record_path:
            messagebox.showinfo('候補を選択', '先に候補を選択してください')
            return
        try:
            correct = (parse_time(self.correct_time.get())
                       if self.correct_time.get().strip() else None)
            save_feedback(self.record_path, selected[0], verdict,
                          correct, self.comment.get())
        except (ValueError, IndexError, OSError) as error:
            messagebox.showerror('保存エラー', str(error))
            return
        self.status.set('フィードバックをこのPCに保存しました')
        self.candidates = load_analysis(self.record_path)['candidates']
        self.show_candidates()
        self.listbox.selection_set(selected[0])
        messagebox.showinfo('保存しました', '判定とコメントを保存しました')


def main():
    root = tk.Tk()
    VideoAnalysisApp(root)
    root.mainloop()


if __name__ == '__main__':
    main()
