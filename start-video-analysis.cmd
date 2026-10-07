@echo off
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
    py -3 -m video_analysis.app
    if errorlevel 1 pause
    exit /b
)
set "PYTHON_EXE="
for /d %%P in ("%LOCALAPPDATA%\Python\pythoncore-*") do if exist "%%~P\python.exe" set "PYTHON_EXE=%%~P\python.exe"
if defined PYTHON_EXE (
    "%PYTHON_EXE%" -m video_analysis.app
    if errorlevel 1 pause
    exit /b
)
python -m video_analysis.app
if errorlevel 1 pause
