@echo off
cd /d %~dp0
if not exist extensions md extensions
cd extensions

if exist oops-plugin-framework (
  cd oops-plugin-framework
  git pull
) else (
  git clone -b master https://github.com/dgflash/oops-plugin-framework.git
  cd oops-plugin-framework
)

call npm install
cd /d %~dp0
