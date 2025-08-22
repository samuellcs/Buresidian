@echo off
echo =================================
echo    BURESIDIAN - Desenvolvimento
echo =================================
echo.

echo Instalando dependencias do backend...
cd backend
pip install -r requirements.txt
echo.

echo Instalando dependencias do frontend...
cd ..\frontend
npm install
echo.

echo =================================
echo Instalacao concluida!
echo.
echo Para iniciar o sistema:
echo 1. Execute: start-backend.bat
echo 2. Execute: start-frontend.bat
echo.
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:8000
echo =================================
pause
