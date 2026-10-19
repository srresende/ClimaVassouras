@echo off

setlocal

D:
cd\
cd Projects\CapturaClima

echo ========================================
echo Historico meteorologico - Vassouras
echo Inicio: %date% %time%
echo ========================================

echo ========================================  >> "D:\Projects\CapturaClima\historico_execucao.log"

python -u "D:\Projects\CapturaClima\clima_vassouras.py" >> "D:\Projects\CapturaClima\historico_execucao.log" 2>&1

set "RESULTADO=%ERRORLEVEL%"

echo Fim: %date% %time% - Codigo: %RESULTADO% >> "D:\Projects\CapturaClima\historico_execucao.log"

exit /b %RESULTADO%
