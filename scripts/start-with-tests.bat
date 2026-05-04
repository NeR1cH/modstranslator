@echo off
REM Batch script to run tests before starting dev server
REM Usage: start-with-tests.bat

echo ========================================
echo Pre-flight Check: Running Tests
echo ========================================
echo.

:TEST_LOOP
REM Run tests
call npm test

REM Check if tests passed
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo [SUCCESS] All tests passed!
    echo Starting development server...
    echo ========================================
    echo.

    REM Start dev server
    call npm run dev
    exit /b 0
) else (
    echo.
    echo ========================================
    echo [FAILED] Tests failed!
    echo ========================================
    echo.
    echo Please fix the errors and choose an option:
    echo   1. Retry tests
    echo   2. Exit
    echo.

    set /p choice="Enter your choice (1 or 2): "

    if "%choice%"=="1" (
        echo.
        echo Retrying tests...
        echo.
        goto TEST_LOOP
    ) else if "%choice%"=="2" (
        echo.
        echo Exiting...
        exit /b 1
    ) else (
        echo.
        echo Invalid choice. Exiting...
        exit /b 1
    )
)
