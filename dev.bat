@echo off
echo Stopping all Next.js dev servers...
powershell -Command "Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowTitle -like '*next*' -or $_.CommandLine -like '*next dev*'} | Stop-Process -Force"
powershell -Command "$ports = 3000..3010; foreach($port in $ports) { $proc = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; if($proc) { Stop-Process -Id $proc -Force -ErrorAction SilentlyContinue } }"
echo All ports cleared!
echo Starting dev server...
npm run dev
