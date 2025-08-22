@echo off
echo Iniciando Frontend (React)...

:: Verifica se a pasta frontend existe
if not exist "frontend" (
    echo Erro: Pasta frontend nao encontrada!
    pause
    exit /b 1
)

:: Muda para a pasta frontend
cd frontend

:: Verifica se node_modules existe
if not exist "node_modules" (
    echo Instalando dependencias...
    npm install
)

:: Inicia o servidor de desenvolvimento
echo Iniciando servidor React...
npm start

pause
