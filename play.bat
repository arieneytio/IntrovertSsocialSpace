@echo off
REM Open OfflineGram in the default browser.
REM %~dp0 expands to the folder this .bat lives in (with trailing \),
REM so the launcher works no matter where it is invoked from.
start "" "%~dp0src\index.html"
