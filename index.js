'use strict'
const axios = require('axios');
const fs = require('fs');
const Web3 = require('web3');
require('dotenv').config({path: 'config.ini'});
const { ethers } = require("ethers");

// prevent app crashing because of some internal exception
    process.on('uncaughtException', function (err) {
        console.error(err);
        //process.exit(1);
    });
    process.setMaxListeners(0);
    require('events').EventEmitter.defaultMaxListeners = 0;


// standard contract detector and code fetcher, this is a generic evm block scan
// that start from selected block to current block.
async function extract(networkId, networkRpc, startBlock, apiEndpoint, getsourcecode, apiKey) {
    magenta(`RPC: ${networkRpc}`)
    const web3 = new Web3(networkRpc);
    const lastBlock = await web3.eth.getBlockNumber();
    yellow(`startBlock=${startBlock} lastBlock=${lastBlock} total=${lastBlock-startBlock}`);
    for( let blockNumber = startBlock; blockNumber < lastBlock; blockNumber++){
        const block = await web3.eth.getBlock( blockNumber , true);
        console.log(blockNumber, block.hash)
        await processTransactions(networkId, blockNumber, block.transactions, apiEndpoint, getsourcecode, apiKey);
    }

}

// as on evm chain contract has a deterministic name generation,
// we have a api for it.
function getContractAddressFromTx(tx){
    const nonce = tx.nonce;
    const from = tx.from;
    return ethers.utils.getContractAddress({from, nonce});
}

// extract transactions for each block and check if the tx is a a contract creation
async function processTransactions(networkId, blockNumber, transactions, apiEndpoint, getsourcecode, apiKey){
    const total = transactions.length;
    for( let txIndex = 0 ; txIndex < total ; txIndex ++ ){
        const tx = transactions[txIndex];
        if( tx.to === null || tx.to == '0x0000000000000000000000000000000000000000' || tx.contractAddress ){
            const deployer = tx.from;
            const contract = getContractAddressFromTx(tx);
            green(blockNumber, deployer, contract);
            await getsourcecode(networkId, apiEndpoint, contract, apiKey)
        }
    }
}

// daly of 1 second for each contract fetch
async function delay(){
    new Promise(resolve => setTimeout(resolve, process.env.API_QUERY_DELAY));
}

// implementation of contract code fetch for etherscan block explorers
async function etherscan(networkId, apiEndpoint, contractAddress, apiKey){
    const urlEndpoint = `https://${apiEndpoint}/api?module=contract&action=getsourcecode&address=${contractAddress}&apikey=${apiKey}`;
    const contractApiResponse = await axios.get(urlEndpoint);
    for( let i = 0 ; i < contractApiResponse.data.result.length ; i ++ ){
        const contractData = contractApiResponse.data.result[i];
        const ABI = contractData.ABI;
        if( ABI == 'Contract source code not verified' ){
            continue;
        }
        const SourceCode = contractData.SourceCode;
        const contractName = contractData.ContractName;
        await saveContractData(networkId, contractAddress, contractName, SourceCode, ABI);
    }
    await delay();
}

// implementation of contract code fetch for blockscout block explorers
async function blockscout(networkId, apiEndpoint, contractAddress, apiKey){
    const urlEndpoint = `https://${apiEndpoint}/api?module=contract&action=getsourcecode&address=${contractAddress}`;
    const contractApiResponse = await axios.get(urlEndpoint);
    for( let i = 0 ; i < contractApiResponse.data.result.length ; i ++ ){
        const contractData = contractApiResponse.data.result[i];
        const ABI = contractData.ABI;
        if( ! contractData.ABI ){
            return;
        }
        const SourceCode = contractData.SourceCode;
        const contractName = contractData.ContractName;
        await saveContractData(networkId, contractAddress, contractName, SourceCode, ABI);
    }
    await delay();
}

// here is devops should implement what to do with the contract data,
// for now, it just save in the file system
async function saveContractData(networkId, contractAddress, contractName, source, abi ){
    const prefix = contractAddress.substring(0, 3);
    const dirName = `${DATA_DIR}/${networkId}/${prefix}/${contractAddress}`;
    yellow(dirName, contractName);
    fs.mkdirSync(dirName, {recursive: true});
    fs.writeFileSync(`${dirName}/${contractName}.sol`, source);
    fs.writeFileSync(`${dirName}/${contractName}.js`, abi);
}

// main runner, can run in parallel various scanners
async function main() {
    /*
    for bsc there is a bug, workaround is here
    https://github.com/ChainSafe/web3.js/issues/3912#issuecomment-1004045262
    */


    if( process.env.TYPE == 'etherscan')
        extract(process.env.NETWORK_ID,
            process.env.RPC,
            process.env.START_BLOCK,
            process.env.EXPLORER,
            etherscan,
            process.env.API_KEY);
    else if( process.env.TYPE == 'etherscan')
        extract(process.env.NETWORK_ID,
            process.env.RPC,
            process.env.START_BLOCK,
            process.env.EXPLORER,
            blockscout,
            process.env.API_KEY);
    else{
        red(`${process.env.TYPE} NOT IMPLEMENTED.`);
        process.exit(1)
    }


}

// this is used for console color output
const chalk = require('chalk');
const magenta = function () { console.log(chalk.magenta(...arguments)) };
const cyan = function () { console.log(chalk.cyan(...arguments)) };
const yellow = function () { console.log(chalk.yellow(...arguments)) };
const red = function () { console.log(chalk.red(...arguments)) };
const blue = function () { console.log(chalk.blue(...arguments)) };
const green = function () { console.log(chalk.green(...arguments)) };

main();
