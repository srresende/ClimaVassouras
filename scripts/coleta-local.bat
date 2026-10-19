@echo off
rem Coleta de reserva no PC: mesma rotina do GitHub Actions (scripts/publicar-csv.sh).
rem Roda num clone proprio, separado da copia de desenvolvimento, porque volta
rem o clone ao estado do GitHub antes de cada tentativa.
rem Codigos de saida: 0 ok, 1 coleta falhou, 2 preparo falhou, 3 git falhou, 4 push recusado.

setlocal EnableExtensions
chcp 65001 >nul

rem Valores padrao; podem ser trocados por variaveis de ambiente (ex.: em testes).
if not defined REPO_URL set "REPO_URL=https://github.com/srresende/ClimaVassouras.git"
if not defined CLONE set "CLONE=D:\CapturaClima\ClimaVassouras"
if not defined LOGS set "LOGS=D:\CapturaClima\logs"
set "PYTHONUTF8=1"

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd"') do set "HOJE=%%i"
if not exist "%LOGS%" mkdir "%LOGS%"
rem Um log por mes.
set "LOG=%LOGS%\coleta-%HOJE:~0,7%.log"

call :rotina >> "%LOG%" 2>&1
set "RESULTADO=%ERRORLEVEL%"
echo Fim: %date% %time% - Codigo: %RESULTADO% >> "%LOG%"
exit /b %RESULTADO%


:rotina
echo ========================================
echo Inicio: %date% %time%

if not exist "%CLONE%\.git" (
    git clone -q "%REPO_URL%" "%CLONE%" || exit /b 2
)
cd /d "%CLONE%" || exit /b 2

if not exist ".venv\Scripts\python.exe" (
    python -m venv .venv || exit /b 2
)
".venv\Scripts\python.exe" -m pip install -q -r requirements.txt || exit /b 2

set /a TENTATIVA=0

:tentar
set /a TENTATIVA+=1
git fetch -q origin main || exit /b 3
git reset -q --hard origin/main || exit /b 3

".venv\Scripts\python.exe" -u coleta\coletar.py || exit /b 1

git add dados/clima_vassouras.csv
git diff --cached --quiet
if not errorlevel 1 (
    echo Sem alteracoes no CSV: nada a publicar.
    exit /b 0
)

git commit -q -m "Dados de %HOJE% (PC)" || exit /b 3
git push -q origin HEAD:main
if not errorlevel 1 (
    echo CSV publicado. O GitHub Actions vai atualizar o site.
    exit /b 0
)

echo Push recusado (tentativa %TENTATIVA%); atualizando e coletando de novo.
if %TENTATIVA% LSS 3 goto tentar
exit /b 4
