#!/bin/bash

if [ ! -d "$(pwd)/artifacts" ]; then
  hardhat compile
fi

hardhat test --network hardhat test/general.test.ts
