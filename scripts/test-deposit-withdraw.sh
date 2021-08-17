#!/bin/bash

if [ ! -d "$(pwd)/artifacts" ]; then
  hardhat compile
fi

hardhat test --network hardhat test/deposit_withdraw.test.ts
