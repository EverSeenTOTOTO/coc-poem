SHELL := /bin/bash

DIST ?= dist
NAME ?= coc-poem
COC_EXTDIR = ~/.config/coc/extensions/node_modules/@everseen/coc-poem

lint:
	npx eslint --fix .
	npx tsc --noEmit
	@echo -e '\033[1;32mNo lint errors found.'

clean:
	-rm -r ${DIST}

build: clean
	npx tsc -p .  --emitDeclarationOnly
	npx tsc-alias
	npx rollup -c rollup.config.js

dev: build
	cp -rv ${DIST}/index.js ${COC_EXTDIR}/dist/

watch:
	npx nodemon --config nodemon.json

test:
	npx jest --coverage --silent

debug:
	node --inspect-brk node_modules/jest/bin/jest.js --coverage --runInBand

.PHONY: dev lint clean build test watch debug
