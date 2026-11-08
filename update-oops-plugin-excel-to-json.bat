@echo off
cd /d %~dp0
if not exist extensions md extensions
cd extensions

if exist oops-plugin-excel-to-json (
  cd oops-plugin-excel-to-json
  git pull
) else (
  rem Official Gitee repo may be private/404; use public mirror
  git clone -b master https://github.com/kada7/oops-plugin-excel-to-json.git
  cd oops-plugin-excel-to-json
)

cd /d %~dp0
