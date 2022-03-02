'use strict'
const axios = require('axios');
const fs = require('fs');
const Web3 = require('web3');
require('dotenv').config({path: '.env'});
const { ethers } = require("ethers");

process.on('uncaughtException', function (err) {
    console.error(err);
    //process.exit(1);
});
process.setMaxListeners(0);

require('events').EventEmitter.defaultMaxListeners = 0;

async function extract(networkId, networkRpc, startBlock, apiEndpoint, getsourcecode, apiKey) {
    if( ! apiKey ){
        red(`Api key not available process.env.${networkId}`);
        process.exit(1);
    }
    const web3 = new Web3(networkRpc);
    const lastBlock = await web3.eth.getBlockNumber();
    for( let blockNumber = startBlock; blockNumber < lastBlock; blockNumber++){
        // green(networkId, networkRpc, blockNumber, startBlock, i);
        const block = await web3.eth.getBlock(blockNumber , true);
        // console.log(blockNumber);
        await processTransactions(blockNumber, block.transactions, apiEndpoint, getsourcecode, apiKey);
    }

}

function getContractAddressFromTx(tx){
    const nonce = tx.nonce;
    const from = tx.from;
    return ethers.utils.getContractAddress({from, nonce});
}

async function processTransactions(blockNumber, transactions, apiEndpoint, getsourcecode, apiKey){
    const total = transactions.length;
    for( let txIndex = 0 ; txIndex < total ; txIndex ++ ){
        const tx = transactions[txIndex];
        if( tx.to === null || tx.contractAddress ){
            // console.log(blockNumber, txIndex, tx);
            const deployer = tx.from;
            const contract = getContractAddressFromTx(tx);
            console.log(blockNumber, deployer, contract);
            await getsourcecode(apiEndpoint, contract, apiKey)
        }
    }
}

async function delay(){
    new Promise(resolve => setTimeout(resolve, 1000));
}
async function etherscan(apiEndpoint, contractAddress, apiKey){
    const urlEndpoint = `https://api.etherscan.io/api?module=contract&action=getsourcecode&address=${contractAddress}&apikey=${apiKey}`;
    const contractApiResponse = await axios.get(urlEndpoint);
    for( let i = 0 ; i < contractApiResponse.data.result.length ; i ++ ){
        const contractData = contractApiResponse.data.result[i];
        const ABI = contractData.ABI;
        if( ABI == 'Contract source code not verified' ){
            continue;
        }
        const SourceCode = contractData.SourceCode;
        const contractName = contractData.ContractName;
        await saveContractData(contractAddress, contractName, SourceCode, ABI);
    }
    await delay();
}
async function saveContractData(contractAddress, contractName, source, abi ){
    const prefix = contractAddress.substring(0, 3);
    const dirName = `./data/${prefix}/${contractAddress}`;
    yellow(dirName, contractName);
    fs.mkdirSync(dirName, {recursive: true});
    fs.writeFileSync(`${dirName}/${contractName}.sol`, source);
    fs.writeFileSync(`${dirName}/${contractName}.abi`, abi);
}
async function main() {
    const rpc = `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`
    const api = 'https://api.etherscan.io';
    extract(1, rpc, 14307006, api, etherscan, process.env.API_ETHERSCAN);
}

const chalk = require('chalk');
const magenta = function () { console.log(chalk.magenta(...arguments)) };
const cyan = function () { console.log(chalk.cyan(...arguments)) };
const yellow = function () { console.log(chalk.yellow(...arguments)) };
const red = function () { console.log(chalk.red(...arguments)) };
const blue = function () { console.log(chalk.blue(...arguments)) };
const green = function () { console.log(chalk.green(...arguments)) };
main();
