@echo off
REM Batch script to run tests automatically
REM Usage: run-tests.bat

echo ========================================
echo Running MOD_TRANSLATOR Tests
echo ========================================
echo.

REM Run tests with coverage
call npm test -- --coverage

REM Check exit code
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo [SUCCESS] All tests passed!
    echo ========================================
    exit /b 0
) else (
    echo.
    echo ========================================
    echo [FAILED] Some tests failed!
    echo ========================================
    exit /b 1
)
