#!/bin/bash

if [ ! -d "$(pwd)/artifacts" ]; then
  hardhat compile
fi

hardhat test --network hardhat test/general.test.ts
hardhat test --network hardhat test/deposit_withdraw.test.ts
hardhat test --network hardhat test/mainnet_fork.test.ts
