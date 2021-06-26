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

console.log(storageLayout);

const storageMap = storage.reduce((obj, entry) => {
  // slot: a string with the decimal value of the slot
  const { label, slot, type } = entry;
  const { encoding } = types[type];
  const paddedSlot = ethers.utils.hexZeroPad(ethers.BigNumber.from(slot), "32");
  if(encoding === "inplace") {
    obj[label] = paddedSlot;
  }
  else if(encoding === "bytes") {
    // TODO: should all storageMap values be functions or can this be done as a class property function?
    // in this case, a value lookup would be necessary first
    // lookup bytes ->
    //   is less than 32 bytes -> return higher-order bytes
    //   is greater -> take the length, go to keccak256(p) and start pulling data 
    obj[label] = () => {
      // if its less than 32 bytes it is encoded in place
      // return paddedSlot;

      // otherwise we actually need to get the value back first to see the length
      // and then go search by the keccak256 hash of the slot
      return ethers.utils.keccak256(paddedSlot);
    }
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

function storageFinder(provider, contract) {
  return (loc) => {
    return provider.getStorageAt(contract.address, loc);
  }
}

async function test() {
  const signer = await provider.getSigner(0);
  const addr = await signer.getAddress();
  const Contract = new ethers.ContractFactory(abi, object, signer);

  const contract = await Contract.deploy();

  const find = storageFinder(provider, contract);

  const x = await find(storageMap.x);
  const y = await find(storageMap.y);
  const z = await find(storageMap.z);

  const balance = await find(storageMap.balances(addr));
  // const short = await find(storageMap.short());
  const long = await find(storageMap.long());

  console.log({
    x: parseInt(x),
    y: parseInt(y),
    z: parseInt(z),
    balance: parseInt(balance),
    // short: ethers.utils.toUtf8String(short.slice(0,24)),
    long: ethers.utils.toUtf8String(long),
  });
}

test()
  .then(() => process.exit(1))
  .catch((ex) => {
    console.log(ex);
    process.exit(1);
  });
