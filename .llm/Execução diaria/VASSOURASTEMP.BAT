@echo off

setlocal

set "PASTA=D:\CapturaClima"
set "SITE=D:\CapturaClima\dashboard-vassouras"
set "LOG=D:\CapturaClima\historico_execucao.log"
set "CSV=clima_vassouras_openmeteo.csv"

D:
cd\
cd CapturaClima

echo ========================================
echo Historico meteorologico - Vassouras
echo Inicio: %date% %time%
echo ========================================

echo ========================================  >> "%LOG%"

python -u "%PASTA%\clima_vassouras.py" >> "%LOG%" 2>&1

set "RESULTADO=%ERRORLEVEL%"

if not "%RESULTADO%"=="0" (
    echo Captura falhou - CSV nao publicado >> "%LOG%"
    goto :fim
)

rem ---- Publicacao do dashboard (GitHub -> Netlify) ----

copy /Y "%PASTA%\%CSV%" "%SITE%\%CSV%" >> "%LOG%" 2>&1
if errorlevel 1 (
    echo ERRO ao copiar o CSV para o dashboard >> "%LOG%"
    set "RESULTADO=2"
    goto :fim
)

cd /d "%SITE%"

git add "%CSV%" >> "%LOG%" 2>&1
git diff --cached --quiet
if not errorlevel 1 (
    echo Sem alteracoes no CSV - nada a publicar >> "%LOG%"
    goto :fim
)

git commit -q -m "Dados de %date%" >> "%LOG%" 2>&1
if errorlevel 1 (
    echo ERRO no git commit >> "%LOG%"
    set "RESULTADO=3"
    goto :fim
)

git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo Repositorio sem remoto configurado - commit feito apenas localmente >> "%LOG%"
    goto :fim
)

git push -q origin main >> "%LOG%" 2>&1
if errorlevel 1 (
    echo ERRO no git push >> "%LOG%"
    set "RESULTADO=4"
    goto :fim
)

echo CSV publicado no GitHub - Netlify vai atualizar o site >> "%LOG%"

:fim
echo Fim: %date% %time% - Codigo: %RESULTADO% >> "%LOG%"

exit /b %RESULTADO%
