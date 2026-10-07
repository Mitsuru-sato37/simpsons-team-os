@echo off
cd /d "%~dp0"
py -3 -m video_analysis.app
if errorlevel 1 pause
