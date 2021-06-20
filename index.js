const fs = require('fs');
const solc = require('solc');
const ganache = require('ganache-core');
const ethers = require('ethers');

const provider = new ethers.providers.Web3Provider(ganache.provider());

const contractName = "Simple";
const fileName = `${contractName}.sol`;
const content = fs.readFileSync("./" + fileName).toString();

const input = {
  language: 'Solidity',
  sources: {
     [fileName]: { content }
  },
  settings: {
    outputSelection: {
      '*': {
        '*': ['storageLayout']
      }
    }
  }
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));

const {storageLayout} = output.contracts[fileName][contractName];

console.log(storageLayout);

const { types, storage } = storageLayout;

const storageMap = storage.reduce((obj, entry) => {
  const { label, slot, type } = entry;
  const { encoding } = types[type];
  if(encoding === "inplace") {
    obj[label] = slot;
  }
  else if(encoding === "mapping") {

  }
  return obj;
}, {});

console.log(storageMap);

// TODO: let's deploy this to the ganache provider
// then we can start updating storage and testing the storageMap
// to see how well it can start to go from the variable to the storage location
