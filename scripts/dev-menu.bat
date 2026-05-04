@echo off
REM Universal test and dev server launcher with menu
REM Combines functionality of all three scripts

setlocal enabledelayedexpansion
set MAX_ATTEMPTS=3

:MAIN_MENU
cls
echo ========================================
echo   MOD_TRANSLATOR - Test ^& Dev Menu
echo ========================================
echo.
echo Choose an option:
echo.
echo   1. Run tests only
echo   2. Start dev server (no tests)
echo   3. Start dev server with test check
echo   4. Start dev server with auto-fix (3 attempts)
echo   5. Exit
echo.
set /p choice="Enter your choice (1-5): "

if "%choice%"=="1" goto RUN_TESTS
if "%choice%"=="2" goto START_DEV
if "%choice%"=="3" goto START_WITH_TESTS
if "%choice%"=="4" goto START_WITH_AUTOFIX
if "%choice%"=="5" goto EXIT
echo.
echo Invalid choice. Please try again.
timeout /t 2 /nobreak > nul
goto MAIN_MENU

REM ============================================================
REM Option 1: Run tests only
REM ============================================================
:RUN_TESTS
cls
echo ========================================
echo Running MOD_TRANSLATOR Tests
echo ========================================
echo.

call npm test -- --coverage

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo [SUCCESS] All tests passed!
    echo ========================================
) else (
    echo.
    echo ========================================
    echo [FAILED] Some tests failed!
    echo ========================================
)

echo.
pause
goto MAIN_MENU

REM ============================================================
REM Option 2: Start dev server (no tests)
REM ============================================================
:START_DEV
cls
echo ========================================
echo Starting Development Server
echo ========================================
echo.

call npm run dev
goto EXIT

REM ============================================================
REM Option 3: Start with test check
REM ============================================================
:START_WITH_TESTS
cls
echo ========================================
echo Pre-flight Check: Running Tests
echo ========================================
echo.

:TEST_LOOP_MANUAL
call npm test

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo [SUCCESS] All tests passed!
    echo Starting development server...
    echo ========================================
    echo.

    call npm run dev
    goto EXIT
) else (
    echo.
    echo ========================================
    echo [FAILED] Tests failed!
    echo ========================================
    echo.
    echo Please fix the errors and choose an option:
    echo   1. Retry tests
    echo   2. Start dev server anyway
    echo   3. Return to main menu
    echo.

    set /p retry_choice="Enter your choice (1-3): "

    if "!retry_choice!"=="1" (
        echo.
        echo Retrying tests...
        echo.
        goto TEST_LOOP_MANUAL
    ) else if "!retry_choice!"=="2" (
        echo.
        echo Starting dev server without tests...
        echo.
        call npm run dev
        goto EXIT
    ) else if "!retry_choice!"=="3" (
        goto MAIN_MENU
    ) else (
        echo.
        echo Invalid choice. Returning to main menu...
        timeout /t 2 /nobreak > nul
        goto MAIN_MENU
    )
)

REM ============================================================
REM Option 4: Start with auto-fix
REM ============================================================
:START_WITH_AUTOFIX
cls
echo ========================================
echo MOD_TRANSLATOR - Auto-Fix Start
echo ========================================
echo.

set ATTEMPT=1

:TEST_LOOP_AUTO
echo [Attempt %ATTEMPT%/%MAX_ATTEMPTS%] Running tests...
echo.

call npm test > test-output.log 2>&1
set TEST_RESULT=%ERRORLEVEL%

if %TEST_RESULT% EQU 0 (
    echo.
    echo ========================================
    echo [SUCCESS] All tests passed!
    echo Starting development server...
    echo ========================================
    echo.

    if exist test-output.log del test-output.log

    call npm run dev
    goto EXIT
) else (
    echo.
    echo ========================================
    echo [FAILED] Tests failed on attempt %ATTEMPT%
    echo ========================================
    echo.

    echo Error details:
    type test-output.log | findstr /C:"FAIL" /C:"Error" /C:"?"
    echo.

    if %ATTEMPT% LSS %MAX_ATTEMPTS% (
        set /a ATTEMPT+=1
        echo Attempting auto-fix...
        echo.

        echo [Auto-fix] Clearing Jest cache...
        call npm test -- --clearCache > nul 2>&1

        echo [Auto-fix] Reinstalling dependencies...
        call npm install > nul 2>&1

        echo.
        echo Retrying tests...
        echo.
        timeout /t 2 /nobreak > nul
        goto TEST_LOOP_AUTO
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
        echo   2. Start dev server anyway
        echo   3. Return to main menu
        echo.

        set /p final_choice="Enter your choice (1-3): "

        if "!final_choice!"=="1" (
            notepad test-output.log
            goto MAIN_MENU
        ) else if "!final_choice!"=="2" (
            echo.
            echo Starting dev server without tests...
            echo.
            call npm run dev
            goto EXIT
        ) else (
            goto MAIN_MENU
        )
    )
)

:EXIT
endlocal
exit /b 0
