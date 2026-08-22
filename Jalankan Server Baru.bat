@echo off
chcp 65001 >nul
cd /d "%~dp0server"
echo Menjalankan server baru...
node index.js
pause
