# PowerShell script to add scripts folder to PATH
# Run this script to access dev-menu.bat from anywhere

$scriptPath = "C:\VSCODE PROJECTS\modstranslator\scripts"

# Get current PATH
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")

# Check if already in PATH
if ($currentPath -like "*$scriptPath*") {
    Write-Host "Scripts folder is already in PATH!" -ForegroundColor Green
    Write-Host "You can now run 'dev-menu.bat' from anywhere."
    pause
    exit
}

# Add to PATH
$newPath = $currentPath + ";" + $scriptPath
[Environment]::SetEnvironmentVariable("Path", $newPath, "User")

Write-Host "Successfully added scripts folder to PATH!" -ForegroundColor Green
Write-Host ""
Write-Host "Please restart your command prompt and run:" -ForegroundColor Yellow
Write-Host "  dev-menu.bat" -ForegroundColor Cyan
Write-Host ""
pause
