
set pre=21

for %%a in (*.mp3) do copy "%%a" "%pre%_%%a"
del "%pre%_%pre%_01*.mp3"
for %%a in (%pre%_*.mp3) do echo %%a >> "%pre%_.m3u"
pause