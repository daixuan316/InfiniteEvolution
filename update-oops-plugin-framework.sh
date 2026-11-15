#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
mkdir -p extensions
cd extensions

if [ ! -d "oops-plugin-framework" ]; then
  git clone -b master https://github.com/dgflash/oops-plugin-framework.git
else
  cd oops-plugin-framework
  git pull
  cd ..
fi

cd oops-plugin-framework
npm install
