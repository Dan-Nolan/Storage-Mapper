const fs = require('fs');
const solc = require('solc');
const path = require('path');

const CONTRACTS_LOC = "../contracts";

function compile(contractName, fileName) {
  const content = fs.readFileSync(path.join(__dirname, CONTRACTS_LOC, fileName)).toString();

  const input = {
    language: 'Solidity',
    sources: {
       [fileName]: { content }
    },
    settings: {
      outputSelection: {
        '*': {
          '*': ['storageLayout', 'evm.bytecode.object', 'abi']
        }
      }
    }
  }

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if(output.errors && output.errors.length > 0) {
    const messages = output.errors.map(x => x.formattedMessage).reduce((p,c) => p + "\n" + c, "");
    throw new Error(messages);
  }

  const { evm: { bytecode: { object: bytecode }}, abi, storageLayout } = output.contracts[fileName][contractName];

  return { bytecode, abi, storageLayout }
}

module.exports = compile;
