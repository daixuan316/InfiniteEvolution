#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
mkdir -p extensions
cd extensions

if [ ! -d "oops-plugin-excel-to-json" ]; then
  # Official Gitee repo may be private/404; use public mirror
  git clone -b master https://github.com/kada7/oops-plugin-excel-to-json.git
else
  cd oops-plugin-excel-to-json
  git pull
fi
