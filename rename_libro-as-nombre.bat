echo off
setlocal enableextensions enabledelayedexpansion

set pre=19
set title=Gesprache mit Gott - Walsch, Neale Donald

REM for %%a in (*.mp3) do copy "%%a" "%pre%_%%a"
REM del "%pre%_%pre%_01*.mp3"
REM for %%a in (%pre%_*.mp3) do echo %%a >> "%pre%_.m3u"

set /a count = 0
set /a vv=0
for %%a in (*.mp3) do (
	set /a count += 1
	if "!count!" == "10" (
		set vv=
		echo ====si=======!vv!
		)
	REM echo !count!
	echo ---------------------
	echo %%a
	echo    cambiar a:
	echo %pre%_!vv!!count!-%title%.mp3
	
	REM copy "%%a" "%pre%_%%a"
	REM del "%pre%_%pre%_01*.mp3"
	REM echo %%a >> "%pre%_.m3u"
	
	REM Copy section here
	REM ...	
)

echo Pulse Ok si está bien así...
pause

set /a count = 0
set /a vv=0
for %%a in (*.mp3) do (
	set /a count += 1
	if "!count!" == "10" (
		set vv=
		echo ====si=======!vv!
		)
	REM echo !count!
	echo ---------------------
	echo %%a
	echo    cambiar a:
	echo %pre%_!vv!!count!-%title%.mp3
	
	REM copy "%%a" "%pre%_%%a"
	REM del "%pre%_%pre%_01*.mp3"
	REM echo %%a >> "%pre%_.m3u"
	
	REM Copy section here
	copy "%%a" "%pre%_!vv!!count!-%title%.mp3"
	REM del "%pre%_%pre%_01*.mp3"
	echo %pre%_!vv!!count!-%title%.mp3 >> "%pre%_%title%.m3u"	
)


echo Fin!!!
pause