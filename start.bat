@echo off
chcp 65001 >nul
echo ================================================
echo   股票交易决策仪表盘 - 一键启动
echo ================================================
echo.

REM 检查Python是否安装
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到Python，请先安装Python 3.9+
    pause
    exit /b 1
)

REM 安装依赖
echo [1/2] 正在检查依赖...
pip install -r "%~dp0requirements.txt" -q

REM 启动应用
echo [2/2] 正在启动应用...
echo.
echo   访问地址: http://127.0.0.1:5566
echo   按 Ctrl+C 停止服务
echo.
python "%~dp0app.py"

pause
