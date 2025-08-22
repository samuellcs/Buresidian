@echo off
echo =================================
echo      BURESIDIAN - Inicio Rapido
echo =================================
echo.
echo Iniciando backend em uma nova janela...
start "Buresidian Backend" cmd /k "cd backend && python main.py"

echo Aguardando 3 segundos...
timeout /t 3 /nobreak > nul

echo Iniciando frontend...
cd frontend
set REACT_APP_API_URL=http://localhost:8000
npm start
