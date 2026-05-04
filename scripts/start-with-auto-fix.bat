@echo off
REM Advanced batch script with auto-fix attempts
REM Usage: start-with-auto-fix.bat

setlocal enabledelayedexpansion
set MAX_ATTEMPTS=3
set ATTEMPT=1

echo ========================================
echo MOD_TRANSLATOR - Auto-Fix Start Script
echo ========================================
echo.

:TEST_LOOP
echo [Attempt %ATTEMPT%/%MAX_ATTEMPTS%] Running tests...
echo.

REM Run tests and capture output
call npm test > test-output.log 2>&1
set TEST_RESULT=%ERRORLEVEL%

if %TEST_RESULT% EQU 0 (
    echo.
    echo ========================================
    echo [SUCCESS] All tests passed!
    echo Starting development server...
    echo ========================================
    echo.

    REM Clean up log file
    if exist test-output.log del test-output.log

    REM Start dev server
    call npm run dev
    exit /b 0
) else (
    echo.
    echo ========================================
    echo [FAILED] Tests failed on attempt %ATTEMPT%
    echo ========================================
    echo.

    REM Show error summary
    echo Error details:
    type test-output.log | findstr /C:"FAIL" /C:"Error" /C:"●"
    echo.

    REM Check if we should retry
    if %ATTEMPT% LSS %MAX_ATTEMPTS% (
        set /a ATTEMPT+=1
        echo Attempting auto-fix...
        echo.

        REM Try to fix common issues
        echo [Auto-fix] Clearing Jest cache...
        call npm test -- --clearCache > nul 2>&1

        echo [Auto-fix] Reinstalling dependencies...
        call npm install > nul 2>&1

        echo.
        echo Retrying tests...
        echo.
        timeout /t 2 /nobreak > nul
        goto TEST_LOOP
    ) else (
        echo.
        echo ========================================
        echo [ERROR] Maximum attempts reached!
        echo ========================================
        echo.
        echo Please review the errors above and fix manually.
        echo Log file saved: test-output.log
        echo.
        echo Options:
        echo   1. Open log file
        echo   2. Exit
        echo.

        set /p choice="Enter your choice (1 or 2): "

        if "!choice!"=="1" (
            notepad test-output.log
        )

        exit /b 1
    )
)
