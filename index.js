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
        '*': ['storageLayout', 'evm.bytecode.object', 'abi']
      }
    }
  }
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));

const { evm: { bytecode: { object }}, abi, storageLayout } = output.contracts[fileName][contractName];

const { types, storage } = storageLayout;

const storageMap = storage.reduce((obj, entry) => {
  // slot: a string with the decimal value of the slot
  const { label, slot, type } = entry;
  const { encoding } = types[type];
  const paddedSlot = ethers.utils.hexZeroPad(ethers.BigNumber.from(slot), "32");
  if(encoding === "inplace") {
    obj[label] = paddedSlot;
  }
  else if(encoding === "mapping") {
    obj[label] = (key) => {
      const paddedKey = ethers.utils.hexZeroPad(key, "32");
      return ethers.utils.keccak256(paddedKey + paddedSlot.slice(2));
    }
  }
  return obj;
}, {});

console.log(storageMap);

async function test() {
  const signer = await provider.getSigner(0);
  const Contract = new ethers.ContractFactory(abi, object, signer);

  const contract = await Contract.deploy();

  const x = await provider.getStorageAt(contract.address, storageMap.x);
  const y = await provider.getStorageAt(contract.address, storageMap.y);
  const z = await provider.getStorageAt(contract.address, storageMap.z);

  const balance = await provider.getStorageAt(contract.address, storageMap.balances(await signer.getAddress()));

  console.log({
    x: parseInt(x),
    y: parseInt(y),
    z: parseInt(z),
    balance: parseInt(balance),
  });
}

test()
  .then(() => process.exit(1))
  .catch((ex) => {
    console.log(ex);
    process.exit(1);
  });
