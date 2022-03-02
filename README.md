# About

This program scan any evm chain for contract.

After contract detection, 
it pass the contract address to a explorer/contract 
verification service to get contract source and ABI. 

# How to run

yarn
node index.js

# How to personalize

Open the file index.js to choose what implementation you want to run.
For now only etherescan format is supported, blockscout will be added
in future.
