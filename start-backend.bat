@echo off
echo Iniciando Backend (Python/FastAPI)...

:: Verifica se a pasta backend existe
if not exist "backend" (
    echo Erro: Pasta backend nao encontrada!
    pause
    exit /b 1
)

:: Muda para a pasta backend
cd backend

:: Verifica se Python está instalado
python --version >nul 2>&1
if errorlevel 1 (
    echo Erro: Python nao esta instalado ou nao esta no PATH!
    pause
    exit /b 1
)

:: Mata processos que possam estar usando a porta 8000
taskkill /F /IM python.exe >nul 2>&1

:: Aguarda um pouco para garantir que a porta foi liberada
timeout /t 2 /nobreak >nul

:: Inicia o servidor FastAPI
echo Iniciando servidor FastAPI na porta 8000...
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

pause
